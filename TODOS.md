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
[x] BLOCKED: User to provide transparent icon.png


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



### Item Tile Enrichment

[x] Current Behavior: Each item shown in feeds has the movie poster, and the title
[x] Desired Behavior: Each item shown in feeds has the movie poster, genre / genre / genre, release date, people starring, runtime, description, and the title. Each item should show the year, genre, and runtime always... and have an i for info icon that when tapped displays the rest of the information, including the description, in a nice scrolling modal. To get description, look at the hero image because that one has a description, and the old chatflix-integrated code will show you the field names for everything else i mention.



### Platform-Specific Issues (Desktop / Electron)
Minor bug fixes / feature requests for the Electron app:

[x] No windows build script in package.json - please create a windows build script and make whatever changes are needed to ensure that it incorporates the correct icon (master version: icon.png)

[x] Linux build works but app icon does not show up in launchers / taskbars / etc (uses the default "X" icon) 


### Platform-Specific Issues (Mobile / Capacitor)
 Android app does not have feature parity with the electron app because it is not using the electron architecture. It does not need to be the same, but it needs to be an equally high quality product...
 
 [x] Biggest issue: user's back button is broken AND there is no injected home button like we do in the electron app... Suggested fix: create a "watch.html" asset that displays basic info about the movie / series: Title, genre, runtime up top... then an EMBED of the vidsrc player page (the https://vidsrc.xyz/embed/movie/... or https://vidsrc.xyz/embed/tv/... format), then miscellaneous information like stars, plot summary, etc... THat is for portrait mode. In LANDSCAPE mode the watch.html page should display the player page in full screen mode (100% width and height). Then update the links from the feeds on the android version only to point to watch.html?tmdbId=123456&type=movie or watch.html?tmdbId=123456&type=tv



 [x] The phone header (with battery, signal etc) and footer (navigation buttons) remain visible in the app including when the player is in full screen mode. Please make the entire app run in full screeen so this shit is hiddne. Thanks.


 
 [x] Full screen button in the player is not working... suggest looking into configuration of the android webview, perhaps it needs to be set to allow full screen requests from the player page, which is an external url