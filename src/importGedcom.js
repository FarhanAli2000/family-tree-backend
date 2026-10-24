// Usage: npm run import [path/to/file.ged]
// Clears the persons/families collections and loads them from the GEDCOM file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Person, Family } from './models.js';
import { parseGedcom } from './gedcom.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] || path.resolve(__dirname, '../data/syed-family.ged');

const { persons, families } = parseGedcom(fs.readFileSync(file, 'utf8'));
console.log(`Parsed ${persons.length} persons and ${families.length} families from ${path.basename(file)}`);

await connectDB();
await Promise.all([Person.deleteMany({}), Family.deleteMany({})]);
await Person.insertMany(persons);
await Family.insertMany(families);
await Promise.all([Person.syncIndexes(), Family.syncIndexes()]);
console.log('Import complete.');
await mongoose.disconnect();
