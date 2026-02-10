

### **Phase 6: Create GitHub Actions Workflow**
1. **.github/workflows/sync-playlists.yml**
   - Cron trigger (daily suggested)
   - Run `node src/index.js`
   - Auto-commit + push changes nếu có diff
   - Send logs / report
