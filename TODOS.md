## Backlog and issues, Vidsrc Viewer Core

### Scope: 

Vidsrc Core is a hybrid app, web based UI wrapped in a native application shell. We support:
- Electron for desktop platforms (No Ads, No Popups)
- Capacitor for Android and iOS (No Ads, No Popups)
- Regular chrome browser (Annoying Ads and Popups)


### Current State: 

### View More and Infinite Scroll Pagination with Category View

Actual Behavior: Clicking "view more" in category view replaces the item grid like flipping to a new page of items... 
[x] Desired: View More button in category view should APPEND the next page of items, like an infinite scroll...  bonus points if you can make infinite scroll work seamlessly so that items just get fetched as you scroll / swipe... keep the view more button as a fallback until we've tested the infinite scroll properly.  that the view more button is no longer needed (keep it in the UI for now as a fallback until infinite scrolls is reliably working and tested)

Actual: Item grid is replaced with a new page of items. 

Priority: Medium 



### App Icon background transparency issue on macOS

Actual Behavior: The app icon, launchpad tiles, etc should the rounded Mac OS tile on a black background; the transparency is not preserved


Desired behavior: The app icon launchpad tiles, etc, should have correct transparency as in icon.png

Priority: Med-High. THink about: how does mac os handle transparency in app icons? Do they support it? Or do you just give them a certain size image and the OS rounds the corners - just make the icon.
[ ] BLOCKED: User to provide transparent icon.png


### Favorites Feed 
[x] Add A Favorites Icon Tab (near the home icon tab in the upper right)
[x] (New Feature): Add a favorites feed that allows users to save their favorite movies and TV shows, by clicking a favorite (heart) button on any item in the app. 

[x] Substask: Add the heart button to all item types 
[x] Subtask: Make favorites Feed section in homepage feeds (make UX flow similar to a category feed, but the favorites feed is loaded from local storage, not from TMDB API
[x] Subtask: Make favorites Feed section (i.e. in homepage feeds


Architecture: Save favorites LOCALLY using localStorage, load them into memory on app load. This is a single user applicaiton, so only one set of favorites is needed!


### Recently Watched Feed
[x] Add A History Icon Tab 

[x] Each time a user clicks to watch a movie or series, append to the recently watched feed. Store recently watched feed LOCALLY using localStorage, load them into memory on app load. This is a single user applicaiton, so only one set of recently watched feed is needed! 

[x] Then Display Recently Watched feed, newest first, in a recently watched feed section in homepage feeds (make UX flow similar to a category feed)