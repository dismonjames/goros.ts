# Migrating to v0.6.1

The root route is now a direct capsule in `app/routes`.

Before:

```txt
app/routes/home/page.html
app/routes/home/page.ts
```

After:

```txt
app/routes/page.html
app/routes/page.ts
```

Move the files after checking the directory contents:

```bash
find app/routes/home -maxdepth 1 -type f -print
mv app/routes/home/page.html app/routes/page.html
mv app/routes/home/page.ts app/routes/page.ts
rmdir app/routes/home
```

`rmdir` only succeeds when no other files remain. After migration, a remaining `app/routes/home/page.html` maps to `/home`, not `/`.
