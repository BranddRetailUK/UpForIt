// Keep the desktop console at /; installed and phone visits use the phone shell.
if (matchMedia('(max-width: 760px)').matches || matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
  location.replace('/mobile' + location.search + location.hash);
}
