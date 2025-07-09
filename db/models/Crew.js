const mongoose = require('mongoose');

const CrewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  captain: { type: String, required: true }, // userId
  members: { type: [String], default: [] }, // userIds
  createdAt: { type: Date, default: Date.now },
  invites: { type: Map, of: Object, default: {} }, // { userId: { invitedBy, invitedAt, crewId, crewName } }
});

module.exports = mongoose.model('Crew', CrewSchema);
