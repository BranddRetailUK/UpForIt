# Admin service ownership

All new admin features and future admin updates belong in `admin-service/`, deployed to the dedicated Railway ADMIN service:
https://admin-production-7548.up.railway.app

Do not add admin tools to the storefront account pages or `frontend-next/app/admin`. Keep customer account and public signup flows in the frontend. Existing storefront admin routes may redirect to the dedicated admin where appropriate. The two services share PostgreSQL; preserve current authentication, admin role checks and same-origin protections.

Railway ADMIN service ID: `170b96b4-a69b-4bba-88ac-0aa8106cc5c9`. See `admin-service/README.md` for deployment instructions.
