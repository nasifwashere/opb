# Gamble Reset and Quest Duplication Fixes

## Overview
Fixed critical issues with gamble reset functionality and quest progress duplication that were causing inconsistent behavior.

## Issues Fixed

### 1. ✅ Gamble Reset Bug
**Issue**: Gambling showed "3/3 gambles" available but clicking buttons said "no gambles remaining"
**Root Cause**: 
- Reset logic updated `user.gamblingData.remainingGambles = 3` but didn't save to database
- When button interactions fetched fresh user data, it had the old/unsaved values
- Timing inconsistency between display and actual database state

**Solution**:
- Added `await user.save()` after resetting gambling data in `commands/gamble.js`
- Added debug logging to track reset operations
- Ensures gambling data is persisted immediately after reset

**Files Modified**: `commands/gamble.js`

### 2. ✅ Quest Progress Duplication Bug  
**Issue**: Single actions (like 1 sail) counted as 2 quest progress (0/3 → 2/3 exploration)
**Root Cause**: 
- Redundant quest handlers in `utils/questSystem.js`
- General handler on line 135 processed all quest types
- Specific handlers for each quest type on lines 147-162 processed them again
- Result: Every quest action was counted twice

**Solution**:
- Removed redundant specific handlers for standard quest types:
  - `battle_win`, `explore`, `pull`, `level_up`, `saga_complete`
- Kept only the general handler and special case for `team_full`
- Enabled quest logging temporarily for debugging

**Files Modified**: `utils/questSystem.js`

## Technical Details

### Gamble Reset Logic (Before vs After):
```javascript
// BEFORE: Reset not saved
if (timeSinceLastGamble >= cooldownTime) {
  user.gamblingData.remainingGambles = 3;
  user.gamblingData.lastGamble = Date.now();
  // No save() - data lost when fresh user fetched
}

// AFTER: Reset properly saved  
if (timeSinceLastGamble >= cooldownTime) {
  user.gamblingData.remainingGambles = 3;
  user.gamblingData.lastGamble = Date.now();
  await user.save(); // Persist immediately
}
```

### Quest Progress Logic (Before vs After):
```javascript
// BEFORE: Double counting
if (requirement.type === actionType) {
  // General handler: +1
  activeQuest.progress[requirement.type] = currentProgress + amount;
}
if (requirement.type === 'explore' && actionType === 'explore') {
  // Specific handler: +1 AGAIN  
  activeQuest.progress['explore'] = (currentProgress || 0) + amount;
}
// Result: 1 action = +2 progress

// AFTER: Single counting
if (requirement.type === actionType) {
  // Only general handler: +1
  activeQuest.progress[requirement.type] = currentProgress + amount;
}
// Special cases only for custom logic (like team_full)
// Result: 1 action = +1 progress ✅
```

## Debug Features Added
- **Gamble Debug Logging**: Tracks reset operations and fresh user data fetching
- **Quest Debug Logging**: Enabled to monitor quest progress tracking (temporarily)

## Testing Instructions
1. **Gamble Reset**: 
   - Wait for gambling cooldown to expire
   - Use `op gamble` command
   - Verify it shows "3/3 gambles" and buttons work
   
2. **Quest Progress**:
   - Use `op sail` command once
   - Check quest progress with `op quest` 
   - Verify exploration quest shows +1 progress (not +2)

## Rollback Plan
If issues arise:
1. Disable quest logging: Set `ENABLE_QUEST_LOGGING = false`
2. Remove debug logs from gamble command
3. Revert quest system changes by adding back specific handlers

## Impact
- ✅ Gambling system now works reliably after cooldown reset
- ✅ Quest progress tracking is accurate (1:1 ratio)  
- ✅ No more quest duplication across all quest types
- ✅ Better debugging capabilities for future issues