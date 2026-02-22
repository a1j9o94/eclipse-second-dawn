# Eclipse Second Dawn - Quick Deploy Checklist

**Time estimate:** 5 minutes
**Current status:** Repository created ✅

---

## Step 1: Deploy to Vercel ⏳

**On your phone:**

1. Go to: https://vercel.com/new
2. Find: `a1j9o94/eclipse-second-dawn`
3. Click "Import"
4. Click "Deploy" (don't change any settings)
5. Wait 2-3 minutes for build

**Expected result:**
- You'll get a URL like: `eclipse-second-dawn-xyz123.vercel.app`
- Build should succeed (we tested locally ✅)

---

## Step 2: Seed Database

**After Vercel deployment succeeds:**

Run these commands from the local workspace:

```bash
cd /workspace/group/eclipse-second-dawn

# Deploy Convex backend functions
npx convex deploy

# Seed all game data (130+ entities)
npx convex run mutations/seed:initializeGlobalGameData
```

**Expected output:**
```
✅ Global game data initialized!
  - Factions: 8
  - Technologies: 41
  - Parts: 30
  - Dice: 21
  - Reputation Tiles: 16
  - Ambassadors: 6
  - Tech->Part links: 41
```

---

## Step 3: Test Your Deployment 🎮

**Visit your Vercel URL and check:**

- [ ] Galaxy board renders
- [ ] Technology tree shows 4 tracks
- [ ] No console errors (open browser DevTools)
- [ ] Real-time Convex sync working

**Test flow:**
1. Load the page
2. Open browser console (F12)
3. Check for errors
4. Verify components render

---

## If Something Goes Wrong

### Vercel build fails
- Check build logs in Vercel dashboard
- Should show same output as our local build (372 KB)

### Database seeding fails
- Make sure Convex deploy succeeded first
- Run: `npx convex dev` to test locally
- Check Convex dashboard: https://dashboard.convex.dev

### Components don't render
- Check browser console for errors
- Verify Convex URL in `convex.json`
- Check Network tab for failed requests

---

## After Successful Deployment

Update the live URL in:
- [ ] README.md (replace "Coming soon - deployment in progress")
- [ ] ECLIPSE_STATUS_DASHBOARD.md (add live URL link)
- [ ] Share link in team chat!

**Command to update README:**
```bash
# After you have the URL, I can update it automatically
# Just tell me the Vercel URL
```

---

## Next Steps After Deployment

1. **End-to-end testing** - Test all game actions work
2. **UI polish** - Complete action UI components
3. **Multiplayer testing** - Create a room, invite players
4. **Integration testing** - Full gameplay loop

---

**Questions?** Let me know if any step fails or you need help debugging!
