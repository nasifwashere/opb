# Quest System and Gamble Command Fixes

## Overview
Fixed multiple issues with the quest system tracking and the gamble command's card recognition for evolved forms.

## Quest System Fixes

### 1. ✅ "Continue your adventure" Quest Fix
**Issue**: Sailing (`op sail`) did not count towards exploration quest progress
**Solution**: Added `updateQuestProgress(user, 'explore', 1)` to sail victory handler in `commands/sail.js`
**Result**: Both `op explore` and `op sail` now count towards exploration quests

### 2. ✅ "Battle wins" Quest Fix  
**Issue**: Only exploration battles counted towards battle win quests, not sailing or dueling
**Solution**: 
- Added `updateQuestProgress(user, 'battle_win', 1)` to sail victory handler in `commands/sail.js`
- Added `updateQuestProgress(user, 'battle_win', 1)` to duel victory handler in `utils/duelHandler.js`
**Result**: Battle wins from exploring, sailing, and dueling all count towards battle win quests

### 3. ✅ "Evolution specialist" Quest Fix
**Issue**: Evolution quest progress wasn't being tracked (stayed at 0/3)
**Problem**: Quest progress was updated AFTER saving user data, so changes weren't persisted
**Solution**: Moved `updateQuestProgress(user, 'evolve', 1)` to occur BEFORE `user.save()` in `commands/evolve.js`
**Result**: Evolution quest progress now properly tracks (0/3 → 1/3 → 2/3 → 3/3)

## Gamble Command Fix

### 4. ✅ Evolved Card Recognition Fix
**Issue**: Gamble command only worked with base "Nami", not evolved forms like "Nami (Climatact, Alabasta)"
**Solution**: Changed exact name matching to partial name matching in `commands/gamble.js`:
```javascript
// Before: exact match only
normalize(card.name) === normalize('Nami')

// After: works with any Nami form
normalize(card.name).includes('nami')
```
**Result**: Gamble command now works with:
- Base "Nami" 
- "Nami (Climatact, Alabasta)"
- "Nami (Zeus, Wano)"
- Any future Nami evolutions

## Technical Details

### Files Modified:
- `commands/sail.js` - Added exploration and battle win quest tracking
- `utils/duelHandler.js` - Added battle win quest tracking for duels
- `commands/evolve.js` - Fixed quest update timing issue
- `commands/gamble.js` - Fixed evolved card recognition

### Quest Progress Integration:
All quest updates use the unified `updateQuestProgress()` function from `utils/questSystem.js`, ensuring consistent tracking across all game modes.

### Backwards Compatibility:
- Existing quest progress is preserved
- No changes to quest definitions or requirements
- All fixes are additive, not breaking changes

## Testing Verification
- ✅ Sailing battles count towards exploration quests
- ✅ Sailing victories count towards battle win quests  
- ✅ Duel victories count towards battle win quests
- ✅ Evolution quest progress increments properly
- ✅ Gamble command works with evolved Nami cards

## Impact
These fixes ensure that players can complete quests through multiple gameplay paths, making the quest system more flexible and intuitive. Players are no longer restricted to specific command types to progress their quests.