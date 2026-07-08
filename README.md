# OpenPlay File App

A full football open-play organizer with:

- Account registration
- Login/logout
- Session handling
- Create match events
- Join/update/leave matches
- Player status: Going / Maybe / Out
- Position picker: GK / DEF / MID / FWD / ANY
- Delete events as creator
- Search matches
- File-based data storage

## Important

This version does **not** use Supabase. It saves data directly into:

```txt
server/data.js
```

That file acts like your simple local database.

## Run the app

```bash
npm install
npm run dev
```

Open the Vite URL shown in your terminal, usually:

```txt
http://localhost:5173
```

The API runs on:

```txt
http://localhost:4000
```

## Notes

This is best for a local prototype. For production deployment, use Supabase/Firebase/PostgreSQL because hosted sites cannot safely write to a JS file like this.
