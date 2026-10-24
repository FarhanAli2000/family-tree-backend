// Minimal GEDCOM 5.5 parser tailored to Family Tree Maker exports.
// Turns the file into plain person / family objects ready for MongoDB.

function parseLines(text) {
  const records = [];
  const stack = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim();
    if (!line) continue;

    const m = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/);
    if (!m) continue;

    const node = {
      level: Number(m[1]),
      xref: m[2] ? m[2].slice(1, -1) : null,
      tag: m[3],
      value: (m[4] ?? '').trim(),
      children: [],
    };

    if (node.level === 0) {
      records.push(node);
      stack.length = 0;
    } else {
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
      const parent = stack[stack.length - 1];
      if (!parent) continue;
      if (node.tag === 'CONT') parent.value += '\n' + node.value;
      else if (node.tag === 'CONC') parent.value += node.value;
      else parent.children.push(node);
    }
    stack.push(node);
  }
  return records;
}

const child = (node, tag) => node.children.find((c) => c.tag === tag);
const children = (node, tag) => node.children.filter((c) => c.tag === tag);
const ref = (value) => value.replace(/@/g, '');

function extractYear(date) {
  const m = date?.match(/\b(1[0-9]|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}

function parseEvent(node) {
  if (!node) return undefined;
  const date = child(node, 'DATE')?.value || undefined;
  const place = child(node, 'PLAC')?.value || undefined;
  return { date, year: extractYear(date), place };
}

function parseName(value) {
  const surname = (value.match(/\/([^/]*)\//)?.[1] ?? '').trim();
  const givenName = value.replace(/\/[^/]*\//, '').replace(/\s+/g, ' ').trim();
  const name = [givenName, surname].filter(Boolean).join(' ') || 'Unknown';
  return { name, givenName, surname };
}

export function parseGedcom(text) {
  const records = parseLines(text);

  const media = new Map();
  for (const r of records) {
    if (r.tag !== 'OBJE' || !r.xref) continue;
    const file = child(r, 'FILE')?.value;
    if (file) media.set(r.xref, file.split(/[\\/]/).pop());
  }

  const persons = [];
  const families = [];

  for (const r of records) {
    if (r.tag === 'INDI') {
      const nameNode = child(r, 'NAME');
      const deathNode = child(r, 'DEAT');
      const photoRef = child(r, '_PHOTO')?.value || child(r, 'OBJE')?.value;
      const sex = child(r, 'SEX')?.value;

      persons.push({
        gid: r.xref,
        ...parseName(nameNode?.value ?? ''),
        title: child(r, 'TITL')?.value || undefined,
        sex: sex === 'M' || sex === 'F' ? sex : 'U',
        living: !deathNode,
        birth: parseEvent(child(r, 'BIRT')),
        death: parseEvent(deathNode),
        photo: photoRef ? media.get(ref(photoRef)) : undefined,
        parentFamilies: children(r, 'FAMC').map((c) => ref(c.value)),
        spouseFamilies: children(r, 'FAMS').map((c) => ref(c.value)),
      });
    } else if (r.tag === 'FAM') {
      families.push({
        gid: r.xref,
        husband: child(r, 'HUSB') ? ref(child(r, 'HUSB').value) : undefined,
        wife: child(r, 'WIFE') ? ref(child(r, 'WIFE').value) : undefined,
        children: children(r, 'CHIL').map((c) => ref(c.value)),
        marriage: parseEvent(child(r, 'MARR')),
      });
    }
  }

  computeDescendantCounts(persons, families);
  computeGenerations(persons, families);
  return { persons, families };
}

// Generation 1 = top-most ancestor; everyone else is one below their deepest parent.
function computeGenerations(persons, families) {
  const famById = new Map(families.map((f) => [f.gid, f]));
  const byId = new Map(persons.map((p) => [p.gid, p]));
  const gen = new Map();

  const visit = (p, visiting = new Set()) => {
    if (gen.has(p.gid)) return gen.get(p.gid);
    if (visiting.has(p.gid)) return 0;
    visiting.add(p.gid);
    let max = 0;
    for (const fid of p.parentFamilies) {
      const fam = famById.get(fid);
      for (const pid of [fam?.husband, fam?.wife]) {
        if (pid && byId.has(pid)) max = Math.max(max, visit(byId.get(pid), visiting));
      }
    }
    visiting.delete(p.gid);
    gen.set(p.gid, max + 1);
    return max + 1;
  };

  for (const p of persons) p.generation = visit(p);
}

function computeDescendantCounts(persons, families) {
  const famById = new Map(families.map((f) => [f.gid, f]));
  const kidsOf = new Map(
    persons.map((p) => [
      p.gid,
      p.spouseFamilies.flatMap((fid) => famById.get(fid)?.children ?? []),
    ])
  );

  for (const p of persons) {
    const seen = new Set();
    const stack = [...kidsOf.get(p.gid)];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || id === p.gid) continue;
      seen.add(id);
      stack.push(...(kidsOf.get(id) ?? []));
    }
    p.descendantCount = seen.size;
  }
}
