/**
 * @typedef CacheState
 * 
 * @property {string} title
 * @property {string} url
 * @property {HTMLElement} content
 */

/**
 * @typedef HistoryState
 * 
 * @property {string} title
 * @property {string} url
 * @property {object} state
 */

/**
 * @typedef PathwayOptions
 * 
 * @property {'router'|'link'|'none'} [mode ]
 * 
 * @property {string} [containerSelector    ]
 * @property {string} [preloadLinkSelector  ]
 * @property {string} [excludeLinkSelector  ]
 * 
 * @property {number} [historyStackSize     ]
 * @property {number} [cacheCapacity        ]
 * @property {number} [transitionDuration   ]
 * 
 * @property {function} [onNavigate         ]
 * @property {function} [onLoadingChange    ]
 * @property {function} [onBeforeLeave      ]
 * @property {function} [onBeforeRender     ]
 * @property {function} [onAfterRender      ]
 * @property {function} [onError            ]
 * 
 */

"use strict";

/**
 * 
 * @param {PathwayOptions} params 
 */
function Pathway(params) {
    this.options = /** @type {PathwayOptions} */ {
        mode:                'router',
        containerSelector:   'body',
        preloadLinkSelector: '[data-preload-link]',
        excludeLinkSelector: '[data-exclude-link]',
        cacheCapacity:       10,
        historyStackSize:    10, 
        transitionDuration:  0,

        onNavigate:          function () {},
        onLoadingChange:     function () {},
        onBeforeLeave:       function () {},
        onBeforeRender:      function () {},
        onAfterRender:       function () {},
        onError:             function () {},
    }
    
    Object.assign(this.options, params)

    this.history = []
    this.cache = new Map()

    this.isLoading = false,
    this.container = document.querySelector(this.options.containerSelector) || document.body

    this.mutation = {observer: null}

    this.cacheResponse(window.location.href, document)
    this.initEvents()
}

/**
 * Initialize events necessary for navigation
 * 
 * @private
 */
Pathway.prototype.initEvents = function () {

    switch (this.options.mode) {
        case 'none':
            break;
        
        case 'link':
            window.addEventListener('load', () => {
                if(this.options.preloadLinkSelector) {
                    this.cacheContainerLinks()
                }
            })
        break;
    
        case 'router': default:
            window.addEventListener('popstate', () => {
                this.navigate(window.location.href, null, false)
            })

            window.addEventListener('click', event => {
                const target = /**@type HTMLAnchorElement */ event.target
                const href = target.href
        
                if (target.tagName.toLowerCase() !== 'a' || !href) {
                    return
                }
        
                if (target.matches(this.options.excludeLinkSelector)) {
                    return
                }
        
                if (href.match('mailto:')) {
                    return
                }
        
                if(window.location.pathname === href || window.location.href === href) {
                    event.preventDefault()
                    event.stopPropagation()
        
                    return
                }
        
                event.preventDefault()
                event.stopPropagation()
        
                const state = {...target.dataset}
                this.navigate(href, state, true)
            })
        
            window.addEventListener('load', () => {
                this.history.push({
                    url: window.location.href,
                    title: document.title,
                    state: null
                })
        
                if(this.options.preloadLinkSelector) {
                    this.cacheContainerLinks()
                }
            })

            this.mutation.observer = new MutationObserver((mutationList, observer) => {
                this.mutationHandler(mutationList, observer)
            })

        break;
    }
}

/**
 * Searching for all the links that they are marked as cachable and performing for each one
 * a fetch request to store them in cache ahead of time 
 * 
 * @private
 */
Pathway.prototype.cacheContainerLinks = function () {
    const links = document.body.querySelectorAll(this.options.preloadLinkSelector)

    const sortWeightedLinks = (a, b) => {
        const dataAttribute = this.options.preloadLinkSelector.replace(/[\[\]]/g, "")

        const aPreloadWeight = a.getAttribute(dataAttribute)
        const bPreloadWeight = b.getAttribute(dataAttribute)

        return aPreloadWeight > bPreloadWeight ? 1 : aPreloadWeight < bPreloadWeight ? -1 : 0
    }
    
    Array.from(links).sort(sortWeightedLinks).forEach(link => {
        const href = link.href

        if (!this.cache.has(href) && !href.match('mailto:')) {
            this.fetchLink(href)
        }
    })
}

/**
 * Performing a GET request to the route and passing the response in the cache
 * 
 * @param {string} url 
 * @param {function} callback 
 * 
 * @private
 */
Pathway.prototype.fetchLink = function (url, resolve, reject) {
    const request = new Request(url, {
        method: 'GET',
        headers: new Headers({
            "Accept": "text/html; charset=UTF-8"
        })
    })
     
    if (this.cache.has(url) && resolve) {
        resolve(url)
        return
    }

    this.isLoading = true
    this.options.onLoadingChange(this, true)

    const roundCodeNumber = code => {
        return Math.trunc(code/100) * 100
    }
    
    window.fetch(request).then(async response => {
        if (roundCodeNumber(response.status) !== 200) {
            throw new Error(`(ERROR) Request failed with status code ${response.status}`)
        }

        const html = await response.text()
        const parser = new DOMParser()
    
        const document = parser.parseFromString(html, 'text/html')
        this.cacheResponse(url, document)

        if (resolve) resolve(url)
    })
    .catch(error => {
        console.warn('(ERROR) Parse document:', error)
        if (reject) reject(url)
        
        this.options.onError(this, error)
    })
    .finally(() => {
        this.isLoading = false
        this.options.onLoadingChange(this, false)
    })
}

/**
 * Performing the actual navigation between the routes.
 * 
 * @param {string} url 
 * @param {Object} historyState
 * @param {boolean} updateHistory 
 * 
 * @private 
 */
Pathway.prototype.navigate = function (url, historyState, updateHistory) {
    if (this.isLoading) return

    this.options.onNavigate(this, url)

    setTimeout(async () => {
        this.options.onBeforeLeave(this)
        
        const contentData = await this.waitFetch(url)
        this.updateDocument(contentData, historyState, updateHistory)

    }, this.options.transitionDuration)
}

/**
 * Update the document with the newly received data and update the router object
 * 
 * @param {CacheState} data 
 * @param {Object} historyState
 * @param {boolean} updateHistory 
 * 
 * @private
 */
Pathway.prototype.updateDocument = function (data, historyState, updateHistory) {
    if (updateHistory) {
        window.history.pushState(historyState, null, data.url)
    }

    this.history.splice(0, this.history.length - this.options.historyStackSize)
    this.history.push({ url: data.url, title: data.title, state: historyState })

    document.title = data.title

    this.mutation.observer.observe(this.container.parentElement, { childList: true })
    this.options.onBeforeRender(this)
    
    this.container.replaceWith(data.content)
}

/**
 * Checks if the container has been updated and performs resets
 * 
 * @param {MutationRecord[]} mutationList 
 * @param {MutationObserver} observer 
 * 
 * @private
 */
Pathway.prototype.mutationHandler = function (mutationList, observer) {
    for (const mutation of mutationList) {
        if (mutation.type !== "childList") continue

        this.container = mutation.addedNodes[0]
        this.options.onAfterRender(this)

        if (this.options.preloadLinkSelector) {
            this.cacheContainerLinks()
        }

        observer.disconnect()

        break
    }
}

/**
 * Waiting for the fetch to resolve and the data to be cached
 * 
 * @param {string} url 
 * 
 * @returns {Promise}
 * @private 
 */
Pathway.prototype.waitFetch = async function (href) {
    const url = await new Promise((resolve, reject) => this.fetchLink(href, resolve, reject));    
    return this.__get(url);
}

/**
 * Cache the fetch response for quick later use
 * 
 * @param {string} url 
 * @param {Document} response 
 * 
 * @private
 */
Pathway.prototype.cacheResponse = function (url, response) {
    const content = this.parseResponse(response)
    const title = response.title

    const cacheData = {title, content, url}
    this.__set(url, cacheData)
}

/**
 * Parse the response and get the content of the container 
 * 
 * @param {Document} document 
 * 
 * @private
 */
Pathway.prototype.parseResponse = function (document) {
    return document.querySelector(this.options.containerSelector) || document.body
}

/**
 * Retrieve cache state with a given key
 *
 * @param {string} key
 *
 * @private
 */
Pathway.prototype.__get = function (key) {
    if (!this.cache.has(key)) 
        return undefined

    let cache_value = this.cache.get(key)

    this.cache.delete(key)
    this.cache.set(key, cache_value)

    return cache_value
}

/**
 * Store a history state to the cache
 * 
 * @param {string} key 
 * @param {CacheState} value 
 * 
 * @private
 */
Pathway.prototype.__set = function (key, value) {
    this.cache.delete(key)

    if (this.cache.size === this.options.cacheCapacity) {
        this.cache.delete(this.cache.keys().next().value)
        this.cache.set(key, value)
    } 
    
    else {
        this.cache.set(key, value)
    }
}

/**
 * LRU retrieval method
 * 
 * @returns 
 */
Pathway.prototype.getLeastRecent = function () {
    return Array.from(this.cache)[0]
}

/**
 * MRU retrieval method
 * 
 * @returns 
 */
Pathway.prototype.getMostRecent = function () {
    return Array.from(this.cache)[this.cache.size - 1]
}

export default Pathway