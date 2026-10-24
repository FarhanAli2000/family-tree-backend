import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    date: String, // raw date text from the GEDCOM file
    year: Number, // extracted year, used for display and sorting
    place: String,
  },
  { _id: false }
);

const personSchema = new mongoose.Schema({
  gid: { type: String, required: true, unique: true }, // GEDCOM id, e.g. "I1"
  name: { type: String, required: true },
  givenName: String,
  surname: String,
  title: String,
  sex: { type: String, enum: ['M', 'F', 'U'], default: 'U' },
  living: Boolean,
  birth: eventSchema,
  death: eventSchema,
  photo: String, // file name inside server/media (if the Media folder is copied there)
  parentFamilies: [String], // FAMC
  spouseFamilies: [String], // FAMS
  descendantCount: { type: Number, default: 0 },
  generation: { type: Number, default: 1 }, // 1 = top-most ancestor
});

const familySchema = new mongoose.Schema({
  gid: { type: String, required: true, unique: true }, // e.g. "F1"
  husband: String,
  wife: String,
  children: [String],
  marriage: eventSchema,
});

export const Person = mongoose.model('Person', personSchema);
export const Family = mongoose.model('Family', familySchema);
