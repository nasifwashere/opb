# Duel Timeout Implementation

## Overview
Added a 2-minute turn timeout system to duels that automatically ends the match if a player doesn't respond to their turn, preventing duels from hanging indefinitely.

## Feature Details

### ✅ **Timeout Mechanism**
- **Duration**: 2 minutes per turn
- **Trigger**: Automatically starts when it becomes a player's turn
- **Action**: If no response within 2 minutes, the inactive player forfeits and loses
- **Reset**: Timer resets with each player action and turn switch

### ✅ **Automatic Loss System**
- **Winner**: The player who DIDN'T timeout gets the victory
- **Rewards**: Full victory rewards are awarded (quest progress, bounty, wins/losses)
- **Message**: Clear indication that the win was "by timeout"
- **Cleanup**: Properly cleans up battle state and removes players from combat

## Technical Implementation

### **Files Modified:**
1. `commands/duel.js` - Added timeout initialization and footer warning
2. `utils/duelHandler.js` - Core timeout logic and management

### **Key Components:**

#### **Timeout Management:**
```javascript
// 2-minute timeout constant
const TURN_TIMEOUT = 2 * 60 * 1000;

// Set up timeout for current player
function setupTurnTimeout(battleData, client) {
    clearTurnTimeout(battleData);
    battleData.turnTimeout = setTimeout(async () => {
        // Auto-forfeit inactive player
        await endDuel(messageId, client, 'timeout', winner);
    }, TURN_TIMEOUT);
}
```

#### **Timeout Lifecycle:**
1. **Start**: Timeout set when duel begins for first player
2. **Clear**: Timeout cleared when player takes action
3. **Reset**: New timeout set when turns switch
4. **End**: Timeout cleared when duel ends naturally

#### **User Experience:**
- **Visual Warning**: "⏰ You have 2 minutes per turn or you forfeit!"
- **Battle Log**: "⏰ [Player] failed to respond within 2 minutes and forfeits!"
- **Victory Message**: "[Winner] wins the duel by timeout!"

### **Integration Points:**

#### **Battle Data Structure:**
```javascript
const battleData = {
    // ... existing fields ...
    turnTimeout: null // Stores active timeout reference
};
```

#### **Action Handlers:**
- `handleDuelAction()` - Clears timeout when valid action taken
- `handleDuelAttack()` - Sets new timeout after turn switch
- `handleDuelDefend()` - Sets new timeout after turn switch
- `endDuel()` - Clears timeout when duel ends

## Benefits

### **For Players:**
- ✅ No more stuck duels waiting forever for inactive opponents
- ✅ Clear time expectations (2 minutes per turn)
- ✅ Fair automatic resolution of inactive duels
- ✅ Full victory rewards for active players

### **For System:**
- ✅ Prevents memory leaks from hanging battle states
- ✅ Automatically cleans up inactive battles
- ✅ Maintains battle system integrity
- ✅ Proper quest progress and statistics tracking

## Testing Scenarios

### **Normal Operation:**
1. Start duel between two players
2. First player should see 2-minute warning
3. Take action within 2 minutes → should work normally
4. Turn switches → new 2-minute timer for other player

### **Timeout Testing:**
1. Start duel between two players
2. Don't take any action for 2+ minutes
3. Inactive player should automatically forfeit
4. Active player should get victory with "by timeout" message
5. Both players should be removed from battle state

### **Edge Cases:**
- Multiple rapid actions → timeouts should clear/reset properly
- Duel ends naturally → timeout should be cleared
- Player disconnects → timeout should still trigger appropriately

## Configuration

### **Timeout Duration:**
Currently set to 2 minutes (`TURN_TIMEOUT = 2 * 60 * 1000`). Can be easily adjusted by changing the constant.

### **Timeout Behavior:**
- **Current**: Inactive player forfeits, other player wins
- **Alternative**: Could be changed to draw/no-contest if needed

## Future Enhancements

### **Potential Additions:**
- **Warning Messages**: 30-second warning before timeout
- **Configurable Timeouts**: Different timeouts for different battle types
- **Timeout Statistics**: Track timeout wins/losses separately
- **Grace Period**: Brief reconnection window for network issues

## Impact
This feature ensures duels remain engaging and don't hang indefinitely, improving the overall user experience and system reliability. Players can now confidently start duels knowing they won't be stuck waiting for inactive opponents.