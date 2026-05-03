
ather than changing Windows scale, set a consistent browser zoom on each monitor and use DevTools to verify:

Monitor	Physical res	Suggested browser zoom	CSS window.innerWidth
Small	1024×768	100%	~1024 px
Large	1920×1080	150%	~1280 px
That way both monitors end up in the same CSS pixel range (~1024–1280 px) and your existing layout handles them with the same breakpoints — no special @media (min-width: 2560px) needed for the large monitor.

If you want to keep the monitors at different effective sizes (small ~1024 px, large ~1920 px), the reliable approach is to anchor everything to max-width + margin: auto on a wrapper div rather than on body:

body having a max-width fights with the header/footer being full-bleed if you ever want that
A .site-wrapper or .page-wrap div is easier to constrain per breakpoint

Or in Chrome address bar: chrome://flags/#force-color-profile isn't it — actually the setting is:
chrome://settings/ → search Page zoom → set to 100%, then restart Chrome

Longer-term: the cleanest dev setup for two monitors is to keep Chrome on the small monitor for DevTools and use the large monitor purely for visual review of the running site. DevTools at 1024×768 with 100% zoom is very usable.


