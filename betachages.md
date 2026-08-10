# Beta Changes

## Feed Layout UI/UX Redesign
- Added a `viewMode` state in `App.tsx` (`immersive`, `classic`, `magazine`).
- Implemented a layout switcher at the top right of the application to let users toggle between three UI designs.
- Created `ClassicFeedScroll.tsx` component which offers a clean, standard vertical card list layout for an easier reading experience.
- Created `MagazineFeedScroll.tsx` component which offers a masonry/bento-grid style layout, highlighting featured articles.
- The immersive layout (Reels/TikTok style scroll) remains the default, but users now have alternative layouts to suit their reading preferences.
