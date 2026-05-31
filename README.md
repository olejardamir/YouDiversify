# YouDiversify

This is not a YouTube music player.

This software was made for my personal music exploration and listening. I use YouTube mostly to listen to music while working or doing something else, and I wanted a tool that helps YouTube behave more like a discovery system instead of a repetition engine.

I call it a YouTube diversifier because it is meant to correct several flaws YouTube has for this kind of listening.

It started with one major problem: YouTube kept suggesting music and videos I had already downvoted, or videos from channels I was not interested in. Since I used YouTube for a long time to listen to music, before Mixes became the default playlist-like experience, I would simply browse the suggestions in the right-hand panel to find something I had never heard before.

That meant I also needed to skip all the `Mix` videos, because they are usually repetitions of things I already know.

Then another issue became obvious: YouTube repeats the same suggestions over and over again in the right-hand panel. So I added a management tool to keep track of everything I came across.

From that point, the extension grew naturally around the functions that were needed: skipping, voting, blocking channels, tracking already-seen videos, and making the right-side recommendations more useful for discovery.

## What It Does

YouDiversify is a Chrome/Chromium extension that adds a small floating player and management panel on YouTube watch pages.

Its main purpose is to help you move through YouTube recommendations while avoiding:

- videos you already visited
- videos you downvoted
- channels you blocked
- YouTube Mix videos
- repeated suggestions from the right-hand recommendation panel

It is designed for passive music discovery: open YouTube, start listening, and let the extension help you keep moving toward something new.

## Main Features

- Floating draggable player on YouTube watch pages.
- Collapsed mini-player mode.
- Light and dark mode.
- Browser toolbar badge showing `ON` or `OFF`.
- Extension power toggle.
- Play/pause, seek, volume, upvote, downvote, and skip controls.
- Downvote-and-skip flow.
- Automatic skip when an already-downvoted video loads.
- Automatic skip when the current video ends.
- Skip-to-next unvisited recommendation.
- Green `?` skip button for untracked skipping.
- Channel blocking from the current video.
- Automatic right-panel cleanup for blocked channels.
- Management grid for visited videos.
- Playlist mode from the managed list.
- Playlist filters for upvoted and neutral videos.
- Playlist shuffle and repeat.
- Import/export of the manager list.
- Sorting and removing entries from the manager list.
- Blocked-channel list with unblock controls.
- Avoids YouTube `Mix` recommendations.
- Light/dark theme preference.
- Stored player position, collapsed state, and manager window position/size.

## The Floating Player

Click the extension icon in the browser toolbar to open the floating player.

The player can be dragged around the page. It has controls for playback, voting, skipping, volume, theme, and the management grid.

Click outside the extension windows to close it. The player treats both the main player and the management grid as part of the app.

The floating player has two layouts:

- Expanded mode: full controls, seek bar, status text, volume panel, and management button.
- Collapsed mode: compact controls and a mini seek bar.

The player can be moved by dragging its header. In collapsed mode, the mini-player itself can be dragged.

The light/dark theme button is a small corner control. Theme choice is saved locally.

## Controls

The main player includes:

- Power: turns the extension behavior on or off.
- Play/pause: controls the current YouTube video.
- Upvote: clicks YouTube's like button and stores that state.
- Downvote: clicks YouTube's dislike button, stores that state, and skips.
- Block channel: stores the current channel as blocked, dislikes the current video, and skips.
- Skip next: skips to the next unvisited, non-Mix recommendation.
- Green `?` skip: skips without keeping the current or destination video in the manager list.
- Volume: opens a vertical volume slider.
- Seek: moves through the current video.
- Management grid: opens or closes the manager window.
- Collapse/expand: switches between full and mini player.
- Close: closes the floating player.

The popup player also includes basic playback, voting, skip, channel block, reset, and seek controls.

## Power And Badge States

The browser toolbar badge shows:

- `ON`: extension behavior is active.
- `OFF`: extension behavior is disabled.
- `!`: short temporary warning when the extension cannot act on the current tab.

When the extension is off, playback controls that depend on the content script are disabled or return an off-state message. The theme and close controls remain available.

## Management Grid

The management grid keeps a local list of videos the extension has seen or interacted with.

It stores metadata such as:

- video id
- title
- URL
- vote state
- channel name
- channel id when available
- timestamps

The grid can be sorted, cleaned, imported, and exported.

Duplicate entries are deduped by video id.

The manager window can be dragged and resized. It can also snap near the player, including below it. The player is always kept visually above the manager window.

Manager mode shows the stored video list with:

- video title
- channel
- vote state
- remove button

The list can be sorted by:

- video
- channel
- vote state

Clicking a video title opens that video in the YouTube tab. Removing an entry deletes it from the local manager list.

If blocked channels exist, the manager can show a blocked-channel section. Channels can be unblocked from there.

Clicking a channel name in the video list highlights the matching blocked-channel row when available.

## Playlist Mode

Playlist mode uses the manager list as a local playlist source.

It filters out:

- downvoted videos
- blocked channels
- videos excluded by the current playlist filters

Playlist controls include:

- include upvoted videos
- include neutral videos
- shuffle
- repeat

When playlist mode is active, skip chooses the next playable video from the managed list instead of only the current right-side YouTube recommendations.

## Channel Blocking

Blocking a channel stores it in the extension manager list.

While a video is playing, the extension silently watches only the right-side recommendation panel. If it sees a recommendation from a blocked channel, it opens that recommendation's menu and tries:

1. `Don't recommend channel`
2. `Not interested`

This is intentionally limited to the right-side panel because that is where this workflow is meant to happen.

The extension restores the right-panel scroll position after it performs one of these automatic menu actions.

## Skip Buttons

There are two skip styles:

- Normal skip: goes to the next unvisited, non-Mix recommendation and tracks it.
- Green `?` skip: goes to the next recommendation without keeping the current or destination video in the manager list.

The green `?` button is useful when you want to jump without affecting the discovery history.

Normal skip saves the current video metadata and stores the destination as visited before navigating.

The green `?` skip removes the current and destination video ids from the manager list and suppresses automatic tracking when the destination loads.

## Automatic Behavior

When a YouTube watch page loads, the extension waits until the dislike state is available. This helps it know whether the video was previously downvoted.

If the current video is already downvoted, the extension skips it automatically unless the video was opened through a one-time forced play action.

When a video ends, the extension attempts to skip to the next playable video.

During skip navigation, the extension prefers clicking the actual recommendation link instead of replacing `location.href`. This helps YouTube perform an in-page transition and keeps the floating player available between videos when possible.

The overlay is restored after skip navigation if the page reloads or YouTube replaces the page context.

## Import And Export

The manager can export a JSON file containing:

- visited video entries
- blocked channels
- playlist settings

The manager can import the same format. Imported video entries are normalized and deduped by video id.

The reset button clears the manager video list and blocked-channel list.

## Installation

This is an unpacked Chrome extension.

1. Open `chrome://extensions/`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder.
5. Open a YouTube watch page.
6. Click the extension icon to open the floating player.

After updating the files, reload the extension from `chrome://extensions/` and refresh any open YouTube tabs.

## Data And Privacy

The extension stores its data locally using Chrome extension storage.

It does not require an external server. The manager list, blocked channels, preferences, and player state are kept in local browser storage.

Stored data includes:

- extension enabled state
- visited videos
- blocked channels
- playlist mode
- playlist include-upvoted setting
- playlist include-neutral setting
- playlist shuffle setting
- playlist repeat setting
- floating player position
- collapsed state
- manager window position and size
- light/dark theme
- short-lived navigation markers for forced play and untracked skip

No account credentials are stored by the extension.

## Permissions

The extension uses Chrome extension permissions for:

- local storage
- tab discovery/control
- script injection for the floating overlay
- active tab access

The manifest includes broad host permissions so the floating overlay can be injected into eligible pages when opened from the toolbar, but the core content script is designed around YouTube watch pages.

## Notes And Limitations

This extension depends on YouTube's page structure. YouTube changes its DOM frequently, so selectors for buttons, menus, recommendation cards, and vote state may need maintenance over time.

The extension is built around YouTube watch pages and the right-hand recommendation panel. It is not meant to replace YouTube Music, build playlists from a service API, or act as a general-purpose media player.

## Why This Exists

The goal is simple: make YouTube better for finding music I have not already heard.

YouTube is very good at repeating what it thinks worked before. This extension pushes in the opposite direction: fewer repeats, fewer unwanted channels, fewer mixes, and more room for discovery.
