import { Router } from 'express';
import { Person, Family } from './models.js';

const router = Router();

const SUMMARY_FIELDS = 'gid name title sex living birth death photo spouseFamilies parentFamilies descendantCount generation';
const MAX_DEPTH = 6;

function summary(p) {
  if (!p) return null;
  return {
    gid: p.gid,
    name: p.name,
    title: p.title,
    sex: p.sex,
    living: p.living,
    birthYear: p.birth?.year,
    deathYear: p.death?.year,
    photo: p.photo,
    descendantCount: p.descendantCount,
    generation: p.generation,
  };
}

async function personsById(ids) {
  const docs = await Person.find({ gid: { $in: [...new Set(ids)] } }, SUMMARY_FIELDS).lean();
  return new Map(docs.map((d) => [d.gid, d]));
}

async function familiesById(ids) {
  const docs = await Family.find({ gid: { $in: [...new Set(ids)] } }).lean();
  return new Map(docs.map((d) => [d.gid, d]));
}

// Overall numbers + the suggested starting person for the tree.
router.get('/stats', async (req, res) => {
  const [persons, families, deceased, deepest, root] = await Promise.all([
    Person.countDocuments(),
    Family.countDocuments(),
    Person.countDocuments({ living: false }),
    Person.findOne({}, 'generation').sort({ generation: -1 }).lean(),
    Person.findOne({ parentFamilies: { $size: 0 }, sex: 'M' }, SUMMARY_FIELDS)
      .sort({ descendantCount: -1 })
      .lean(),
  ]);
  res.json({ persons, families, deceased, generations: deepest?.generation ?? 0, root: summary(root) });
});

// Search by name (Urdu or English, partial match).
router.get('/persons', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = q ? { name: { $regex: escaped, $options: 'i' } } : {};
  const docs = await Person.find(filter, SUMMARY_FIELDS).sort({ descendantCount: -1 }).limit(limit).lean();
  res.json(docs.map(summary));
});

// Full profile: parents, spouses with their children, siblings.
router.get('/persons/:gid', async (req, res) => {
  const person = await Person.findOne({ gid: req.params.gid }).lean();
  if (!person) return res.status(404).json({ error: 'Person not found' });

  const families = await familiesById([...person.parentFamilies, ...person.spouseFamilies]);
  const parentFams = person.parentFamilies.map((id) => families.get(id)).filter(Boolean);
  const spouseFams = person.spouseFamilies.map((id) => families.get(id)).filter(Boolean);

  const relatedIds = [
    ...parentFams.flatMap((f) => [f.husband, f.wife, ...f.children]),
    ...spouseFams.flatMap((f) => [f.husband, f.wife, ...f.children]),
  ].filter(Boolean);
  const people = await personsById(relatedIds);
  const get = (id) => summary(people.get(id));

  res.json({
    ...person,
    _id: undefined,
    __v: undefined,
    parents: parentFams.flatMap((f) => [get(f.husband), get(f.wife)]).filter(Boolean),
    siblings: [...new Set(parentFams.flatMap((f) => f.children))]
      .filter((id) => id !== person.gid)
      .map(get)
      .filter(Boolean),
    spouses: spouseFams.map((f) => ({
      familyId: f.gid,
      spouse: get(f.husband === person.gid ? f.wife : f.husband),
      marriage: f.marriage,
      children: f.children.map(get).filter(Boolean),
    })),
  });
});

// Descendant tree, loaded level by level. Nodes at the depth limit have
// `children: null` and `hasMore: true` so the client can load them on demand.
router.get('/persons/:gid/tree', async (req, res) => {
  const depth = Math.min(Math.max(Number(req.query.depth) || 3, 1), MAX_DEPTH);
  const root = await Person.findOne({ gid: req.params.gid }, SUMMARY_FIELDS).lean();
  if (!root) return res.status(404).json({ error: 'Person not found' });

  const makeNode = (p) => ({ ...summary(p), families: [], hasMore: false, _src: p });
  const rootNode = makeNode(root);
  const visited = new Set([root.gid]);
  let level = [rootNode];

  for (let d = 0; d < depth && level.length; d++) {
    const families = await familiesById(level.flatMap((n) => n._src.spouseFamilies));
    const ids = [...families.values()].flatMap((f) => [f.husband, f.wife, ...f.children]).filter(Boolean);
    const people = await personsById(ids);
    const next = [];

    for (const node of level) {
      for (const fid of node._src.spouseFamilies) {
        const fam = families.get(fid);
        if (!fam) continue;
        const spouseId = fam.husband === node.gid ? fam.wife : fam.husband;
        const kids = fam.children
          .filter((id) => people.has(id) && !visited.has(id))
          .map((id) => {
            visited.add(id);
            return makeNode(people.get(id));
          });
        next.push(...kids);
        node.families.push({ familyId: fam.gid, spouse: summary(people.get(spouseId)), children: kids });
      }
    }
    level = next;
  }

  for (const node of level) {
    node.hasMore = node._src.spouseFamilies.length > 0 && node._src.descendantCount > 0;
    node.families = node.hasMore ? null : [];
  }

  res.json(JSON.parse(JSON.stringify(rootNode, (k, v) => (k === '_src' ? undefined : v))));
});

// Lineage from the top-most ancestor down to this person (follows the father's line first).
router.get('/persons/:gid/lineage', async (req, res) => {
  const chain = [];
  const seen = new Set();
  let gid = req.params.gid;

  while (gid && !seen.has(gid) && chain.length < 200) {
    seen.add(gid);
    const p = await Person.findOne({ gid }, SUMMARY_FIELDS).lean();
    if (!p) break;
    chain.unshift(summary(p));
    const fam = p.parentFamilies[0] ? await Family.findOne({ gid: p.parentFamilies[0] }).lean() : null;
    gid = fam?.husband || fam?.wife;
  }
  res.json(chain);
});

export default router;
