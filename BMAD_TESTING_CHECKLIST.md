# 🧪 BMAD Integration Testing Checklist

## ✅ **Frontend UI Tests** (No API Required)

### **Test 1: Enhanced ChatWindow Interface**
Navigate to: `http://localhost:3000/chat`

**What to Look For:**
- [ ] ChatWindow loads without errors
- [ ] Header shows "Agent Chat" initially
- [ ] 🚀 "Start BMAD" button appears in header
- [ ] Button has gradient styling (blue to purple)
- [ ] Clicking button shows/hides workflow initiator panel

### **Test 2: Workflow Trigger Detection**
In the chat input, type these messages one by one:

**Trigger Messages (Should Show System Suggestion):**
- [ ] "I want to build a todo application"
- [ ] "Help me create a dashboard" 
- [ ] "Start new project"
- [ ] "Build an app"

**Expected Result:**
- System message appears after ~1 second
- Message has blue gradient background
- Contains suggestion text about BMAD workflow
- Shows action buttons: "Start BMAD Workflow" and "Continue Chat"

**Non-Trigger Message (Should NOT Show Suggestion):**
- [ ] "Hello, how are you today?"

### **Test 3: BMAD Workflow Initiator Panel**
Click the 🚀 "Start BMAD" button in header

**What to Look For:**
- [ ] Panel appears below header with gray background
- [ ] Shows "🤖 Start BMAD Workflow" title
- [ ] Has close button (✕) in top right
- [ ] Contains large textarea for user prompt
- [ ] Shows character count indicator
- [ ] Has "Advanced Options" toggle
- [ ] Contains "🚀 Start BMAD Workflow" submit button
- [ ] Button is disabled when textarea is empty
- [ ] Button enables when typing 10+ characters

### **Test 4: Advanced Options**
In the workflow initiator, click "Advanced Options"

**What to Look For:**
- [ ] Panel expands to show additional options
- [ ] Workflow Name input field appears
- [ ] Workflow Sequence dropdown appears
- [ ] Sequence preview shows agent steps
- [ ] System status shows at bottom

### **Test 5: Message Display Enhancements**
Check the message display in chat:

**User Messages:**
- [ ] Blue background, right-aligned
- [ ] Shows "User" sender name
- [ ] Shows timestamp

**System Messages:**
- [ ] Special gradient backgrounds
- [ ] Shows sender badges (Suggestion, Workflow)
- [ ] Action buttons when applicable
- [ ] Left-aligned

### **Test 6: Message Input Enhancements**
Check the message input area:

**Normal Mode:**
- [ ] Shows lightbulb (💡) icon on right side of input
- [ ] Clicking lightbulb shows workflow suggestions
- [ ] Suggestions include "Build a todo app", "Create dashboard", etc.
- [ ] Send button shows "Send"

**BMAD Mode (After starting workflow):**
- [ ] Shows BMAD badge next to input
- [ ] Input has blue border styling
- [ ] Placeholder text changes to workflow-specific text
- [ ] Send button shows rocket (🚀) icon

### **Test 7: Dark Mode Support**
Toggle dark mode (if available) and verify:
- [ ] All BMAD components respect dark mode
- [ ] Gradients work in dark mode
- [ ] Text remains readable
- [ ] Borders and backgrounds adapt

## ⚠️ **API Integration Tests** (Requires API Fix)

### **Test 8: System Health Check**
Navigate to: `http://localhost:3001/test-bmad`

**Current Issue:** API endpoints returning HTML instead of JSON
**Expected When Fixed:**
- [ ] System Status shows "BMAD System: Online"
- [ ] Shows number of agents loaded
- [ ] Shows number of sequences available
- [ ] Green status indicator

### **Test 9: Workflow Creation**
In workflow initiator, fill form and submit:

**Expected When Fixed:**
- [ ] Form submits successfully
- [ ] Workflow status panel appears
- [ ] Shows progress bar and agent status
- [ ] Real-time updates every 2 seconds
- [ ] Chat switches to BMAD mode

### **Test 10: Real-time Status Updates**
When workflow is running:

**Expected When Fixed:**
- [ ] Status panel shows current agent
- [ ] Progress bar updates
- [ ] Agent status indicators change
- [ ] Communication timeline updates
- [ ] Message count increases

## 🔧 **Current Issues to Fix**

### **API Path Resolution**
The BMAD API endpoints have import path issues. Need to fix:
```javascript
// In /api/bmad/agents/route.js
import { authOptions } from '../../auth/[...nextauth]/route.js';

// In /api/bmad/workflow/route.js  
import { authOptions } from '../../auth/[...nextauth]/route.js';
```

### **Module Dependencies**
May need to check if all BMAD dependencies are properly installed:
- js-yaml ✅ (already installed)
- EventEmitter (Node.js built-in) ✅

### **Authentication Requirement**
API endpoints require authentication, so need to:
1. Either login first, or
2. Add test endpoints that bypass auth for testing

## 🎯 **Testing Priority**

1. **HIGH PRIORITY** - Frontend UI tests (Tests 1-7)
   - These work without API and show integration success
   
2. **MEDIUM PRIORITY** - Fix API import paths
   - Resolve authOptions import issues
   
3. **LOW PRIORITY** - Full workflow execution
   - Requires working API endpoints

## 📝 **Test Results Template**

Copy this to track your testing:

```
BMAD Integration Test Results
=============================

Frontend Tests:
[ ] Test 1: ChatWindow Interface
[ ] Test 2: Trigger Detection  
[ ] Test 3: Workflow Initiator
[ ] Test 4: Advanced Options
[ ] Test 5: Message Display
[ ] Test 6: Input Enhancements
[ ] Test 7: Dark Mode

Issues Found:
- 
- 
- 

API Tests:
[ ] Test 8: System Health (BLOCKED - API issues)
[ ] Test 9: Workflow Creation (BLOCKED - API issues) 
[ ] Test 10: Real-time Updates (BLOCKED - API issues)

Overall Assessment:
Frontend Integration: ___/10
API Integration: ___/10
Ready for Production: Yes/No
```

## 🚀 **Next Steps After Testing**

1. **If Frontend Tests Pass:** Integration is successful! 
2. **If API Issues Persist:** Focus on fixing import paths
3. **If All Tests Pass:** Ready to implement actual agent task execution

---

**Start testing at:** `http://localhost:3000/chat`