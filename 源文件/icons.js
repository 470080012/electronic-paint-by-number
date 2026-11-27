(function(root){
 'use strict';
 const paths={
 palette:'<path fill="#fffbef" d="M7 13C2 20 5 32 14 34c6 2 7-4 12-2 7 3 12-1 12-8 0-13-22-21-31-11Z"/><ellipse cx="15" cy="17" rx="2.3" ry="2" fill="#df737a" stroke="none"/><circle cx="10" cy="24" r="2" fill="#efbe66" stroke="none"/><circle cx="18" cy="28" r="2" fill="#b7bc94" stroke="none"/><circle cx="23" cy="17" r="2" fill="#e6935e" stroke="none"/><path fill="#ee8b7a" d="M21 29C32 9 38 3 42 4c3 5-7 17-16 27Z"/><path fill="#fff3d8" d="m20 28 7 4c-1 9-9 9-11 7 5-2 1-6 4-11Z"/>',
 gallery:'<path fill="#fff9ee" d="M7 8h29v28H7z"/><path fill="#f4ac78" d="M4 12h32v25H4z"/><rect x="8" y="16" width="24" height="17" rx="2" fill="#fff8ed"/><circle cx="14" cy="21" r="3" fill="#e99272" stroke="none"/><path fill="#c7cb9d" d="m9 31 8-8 5 5 4-4 6 7"/><path d="m12 8 4-4 7 4" fill="#f7c0a1"/>',
 camera:'<path fill="#f1bca5" d="M5 14h8l3-6h15l3 6h7v23H5z"/><path d="M9 14v-4h5"/><circle cx="23" cy="25" r="9" fill="#fff5df"/><circle cx="23" cy="25" r="6" fill="#f7c6ab"/><path d="m39 5 2-3M43 11h4M34 4V1"/><circle cx="10" cy="19" r="1" fill="#6b3228"/>',
 book:'<path fill="#fff6e5" d="M9 9h30v31H9z"/><path d="M6 12h6M6 19h6M6 26h6M6 33h6"/><path d="M15 5v8M22 5v8M29 5v8M36 5v8"/><path fill="#ec8f8d" stroke="none" d="M24 33c-18-10-7-20 0-11 9-9 19 2 0 11Z"/>',
 back:'<path d="M20 9 6 22l14 12v-8h19v-9H20z" fill="#ef9c8d"/>',
 search:'<circle cx="19" cy="18" r="12" fill="#fffaf1"/><path d="m28 28 11 10 3-4-11-10" fill="#e58d74"/><path stroke="#efb59e" d="M12 15c1-5 6-6 9-5"/>',
 upload:'<path d="M11 32H8C0 29 4 20 10 20c0-15 20-18 24-4 13-1 15 16 4 16h-5"/><path d="M23 39V19m-7 7 7-7 7 7"/>',
 brush:'<path fill="#ef9a78" d="M16 27C25 9 37 1 40 4c3 4-7 17-19 28Z"/><path fill="#fff3cb" d="m15 26 8 7c-2 10-13 12-17 6 9 0 3-9 9-13Z"/><path d="m15 28 6 6"/>',
 hand:'<path d="M21 26 16 13c-1-4 4-6 6-2l6 11-1-8c0-4 4-4 5-1l3 10 1-5c1-3 5-2 5 1l-1 15c-1 12-14 12-20 5L9 27c-3-4 1-7 4-4l8 7" fill="#fff4dc"/><path d="M14 7 9 3M8 13H2M28 4l2-4" stroke="#df737a"/>',
 undo:'<path fill="#fff5e5" d="M20 7 4 19l16 9v-7c18-3 21 8 11 14 18-2 19-24-11-23Z"/>',
 hint:'<path fill="#efb273" d="m10 39 22-25 5 5-22 25z"/><path fill="#f4cc6e" d="m31 2 3 7 8 1-6 5 1 8-7-4-7 3 2-8-5-5 8-1z"/><path d="M9 7v8M5 11h8M41 30v7M38 33h6" stroke="#e18c7c"/>',
 save:'<path d="M20 4h7v23l6-6 5 5-14 13L10 26l5-5 5 6z" fill="#f1a38b"/><path d="M5 34v9h37v-9" fill="#fff2d7"/>',
 fit:'<path d="M17 6H6v11m24-11h11v11M6 30v11h11m24-11v11H30"/><rect x="15" y="15" width="17" height="17" rx="3" fill="#f6c6a0"/>',
 star:'<path fill="#f8d77e" d="m23 3 6 13 15 2-11 10 2 15-12-7-13 7 3-15L2 18l15-2z"/>',
 check:'<circle cx="23" cy="23" r="18" fill="#fff6eb"/><path stroke="#df737a" stroke-width="4" d="m12 23 8 8 14-17"/>',
 rotate:'<path d="M10 15c7-14 29-7 29 9 0 16-23 22-29 7M10 5v12h12"/><path d="M18 20h12v12H18z" fill="#f7c5a9"/>',
 crop:'<path d="M13 4v30h30M4 13h30v30"/><path d="M20 6h20v20" stroke="#df737a"/>',
 trash:'<path d="M9 13h29M17 12V7h14v5M13 16l2 25h19l3-25M21 20v14M29 20v14"/>',
 close:'<path d="m12 12 23 23m0-23L12 35"/>',
 share:'<path d="m17 21 14-8M17 27l14 8"/><circle cx="10" cy="24" r="7" fill="#fff6e5"/><circle cx="36" cy="10" r="7" fill="#f4b59a"/><circle cx="36" cy="38" r="7" fill="#f4b59a"/>',
 follow:'<circle cx="19" cy="13" r="8" fill="#fff6e5"/><path d="M5 39c0-17 27-17 27 0H5Z" fill="#f6c6a0"/><path d="M39 24v16M31 32h16"/>',
 gift:'<path d="M5 20h38v9H5zM9 29v14h30V29M20 20v23M28 20v23" fill="#fff3df"/><path d="M24 20C3 21 9 1 18 9c4 3 6 11 6 11Zm0 0C45 21 39 1 30 9c-4 3-6 11-6 11Z" fill="#f5b99f"/>',
 plus:'<path d="M23 8v30M8 23h30"/>',
 minus:'<path d="M8 23h30"/>'
 };
 function icon(name,cls){return '<svg class="icon '+(cls||'')+'" viewBox="0 0 48 48" fill="none" stroke="#64362c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.brush)+'</svg>';}
 root.OilIcon=icon;
})(window);
