# Deployment Guide

## Production Database Migration

After deploying to Vercel, you need to push the Prisma schema to your production database.

### Option 1: Using PowerShell (Windows)

```powershell
# Set your production database URL
$env:DATABASE_URL = "postgresql://user:password@host:port/database?sslmode=require"

# Run the migration script
.\scripts\migrate-production.ps1
```

### Option 2: Using Bash (Mac/Linux)

```bash
# Set your production database URL
export DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Make script executable
chmod +x scripts/migrate-production.sh

# Run the migration script
./scripts/migrate-production.sh
```

### Option 3: Direct Command

```bash
# Set your production DATABASE_URL first
npx prisma db push --skip-generate
```

## What This Does

The migration script will:
1. ✅ Check if DATABASE_URL is set
2. ✅ Connect to your production database  
3. ✅ Create all missing tables (including `KeyVerification`)
4. ✅ Update existing tables with new columns
5. ✅ Create indexes and constraints

## Getting Your Database URL

### From Vercel:
1. Go to your project dashboard
2. Settings → Environment Variables
3. Find `DATABASE_URL` value
4. Copy the full connection string

### From Database Provider:
- **Neon**: Dashboard → Connection String
- **Supabase**: Settings → Database → Connection string
- **Railway**: Database → Connect → Postgres Connection URL

## Important Notes

⚠️ **Run this AFTER your first successful Vercel deployment**

⚠️ **Do NOT commit your DATABASE_URL to git**

✅ **Safe to run multiple times** - Prisma will only apply changes

✅ **No data loss** - Only creates/updates schema, doesn't delete data

## Verifying Success

After running the migration, your app should:
- ✅ Load without "table does not exist" errors
- ✅ Allow user verification features to work
- ✅ Support all E2E encryption features

## Troubleshooting

### "Prisma schema failed to load"
- Make sure you're in the project root directory
- Run `npm install` first

### "Could not connect to database"
- Verify your DATABASE_URL is correct
- Check if database allows connections from your IP
- For cloud databases, ensure SSL mode is enabled

### "Permission denied"
- Your database user needs CREATE TABLE permissions
- Check with your database provider

## Need Help?

If you encounter issues:
1. Check the Vercel deployment logs
2. Verify all environment variables are set
3. Test database connection with `npx prisma db pull`
