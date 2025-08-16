## Pathway Router 

A lightweight client-side router that manages navigation, history, caching, and rendering of content within a container element.

> This is an asynchronous vanilla JS router, simulating the AJAX process, but with some improvements. Inspired by the [PJAX Router](https://github.com/martinlaxenaire/pjax-router/tree/master).



## Options

Configuration options for the `Pathway` router.

| Option                | Type                      | Description                             |
| --------------------- | ------------------------- | --------------------------------------- |
| `containerSelector`   | `string`                  | CSS selector for the content container. |
| `preloadLinkSelector` | `string`                  | CSS selector for links to preload.      |
| `excludeLinkSelector` | `string`                  | CSS selector for links to exclude.      |
| `historyStackSize`    | `number`                  | Maximum number of history entries.      |
| `cacheCapacity`       | `number`                  | Maximum number of pages cached.         |
| `transitionDuration`  | `number`                  | Transition duration in milliseconds.    |
| `updateRouterHistory` | `boolean`                 | Whether to update browser history.      |
| `popstateEvent`       | `boolean`                 | Enable handling of `popstate` events.   |
| `clickEvent`          | `boolean`                 | Enable link click interception.         |
| `mutationObserver`    | `boolean`                 | Enable monitoring DOM mutations.        |
| `scrollRestoration`   | `boolean`                 | Restore scroll position on navigation.  |
| `onNavigate`          | `OnNavigateCallback`      | Called before navigation.               |
| `onLoadingChange`     | `OnLoadingChangeCallback` | Called on loading state changes.        |
| `onBeforeLeave`       | `OnBeforeLeaveCallback`   | Called before leaving a page.           |
| `onBeforeRender`      | `OnBeforeRenderCallback`  | Called before rendering content.        |
| `onAfterRender`       | `OnAfterRenderCallback`   | Called after rendering content.         |
| `onError`             | `OnErrorCallback`         | Called on navigation/rendering error.   |



## Callbacks

These callbacks allow you to hook into the lifecycle of navigation and rendering.

### `OnLoadingChangeCallback`

Called when loading state changes.

```ts
(router: Pathway, state: boolean) => void
```

* `router`: The active `Pathway` instance.
* `state`: `true` if loading, `false` otherwise.

### `OnNavigateCallback`

Called before navigating to a new URL.

```ts
(router: Pathway, url: string) => void
```


### `OnBeforeLeaveCallback`

Called before leaving the current page.

```ts
(router: Pathway) => void
```


### `OnBeforeRenderCallback`

Called before rendering new content.

```ts
(router: Pathway) => void
```


### `OnAfterRenderCallback`

Called after rendering new content.

```ts
(router: Pathway) => void
```

### `OnErrorCallback`

Called when a navigation or rendering error occurs.

```ts
(router: Pathway, error: ErrorEvent) => void
```



## Example

```js
const router = new Pathway({
  containerSelector: "#app",
  excludeLinkSelector: "a.external, a[download]",
  cacheCapacity: 20,
  scrollRestoration: true,

  onNavigate: (router, url) => {
    console.log("Navigating to:", url);
  },
  onAfterRender: (router) => {
    console.log("New content rendered!");
  },
  onError: (router, error) => {
    console.error("Routing error:", error);
  }
});
```