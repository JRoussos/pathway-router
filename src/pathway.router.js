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
 * @property {string} containerSelector
 * @property {string} cacheLinkSelector
 * 
 * @property {number} historyStackSize
 * @property {number} cacheCapacity
 * @property {number} transitionDuration
 * 
 * @property {function} onStart
 * @property {function} onError
 * @property {function} onBeforeLeave
 * @property {function} onBeforeRender
 * @property {function} onLoadingChange
 * 
 */

"use strict";

/**
 * 
 * @param {PathwayOptions} params 
 */
function Pathway(params) {
    this.options = {
        containerSelector: 'body',

        historyStackSize: 10, 
        cacheCapacity: 10,
        cacheLinkSelector: '[data-preload-link]',

        transitionDuration: 0,

        onStart: function () {},
        onError: function () {},
        onBeforeLeave: function () {},
        onBeforeRender: function () {},
        onLoadingChange: function () {},
    }
    
    Object.assign(this.options, params)

    this.history = []
    this.cache = new Map()

    this.isLoading = new Proxy({state: false}, this.proxyHandler(this.options.onLoadingChange))
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
    window.addEventListener('popstate', () => {
        this.navigate(window.location.href, false)
    })

    window.addEventListener('click', event => {
        const target = /**@type HTMLElement */ event.target
        const href = target.getAttribute('href')

        if (target.tagName.toLowerCase() !== 'a' || !href) {
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
        this.navigate(href, true, state)
    })

    window.addEventListener('load', () => {
        this.history.push({
            url: window.location.href,
            title: document.title,
            state: null
        })

        if(this.options.cacheLinkSelector) {
            this.cacheContainerLinks()
        }
    })

    this.mutation.observer = new MutationObserver((mutationList, observer) => {
        this.mutationHandler(mutationList, observer)
    })
}

/**
 * Searching for all the links that they are marked as cachable and performing for each one
 * a fetch request to store them in cache ahead of time 
 * 
 * @private
 */
Pathway.prototype.cacheContainerLinks = function () {
    const links = document.body.querySelectorAll(this.options.cacheLinkSelector)

    const sortWeightedLinks = (a, b) => {
        const dataAttribute = this.options.cacheLinkSelector.replace(/[\[\]]/g, "")

        const aPreloadWeight = a.getAttribute(dataAttribute)
        const bPreloadWeight = b.getAttribute(dataAttribute)

        return aPreloadWeight > bPreloadWeight ? 1 : aPreloadWeight < bPreloadWeight ? -1 : 0
    }
    
    Array.from(links).sort(sortWeightedLinks).forEach(link => {
        const href = link.href

        if (!this.cache.has(href) && !href.match('mailto:')) {
            this.fetchLink(href, false)
        }
    })
}

/**
 * Requesting the route and waitting for the response 
 * 
 * @param {string} url 
 * @param {function} callback 
 * 
 * @private
 */
Pathway.prototype.fetchLink = function (url, updateHistory, callback) {
    const request = new Request(url, {
        method: 'GET',
        headers: new Headers({
            "Accept": "text/html; charset=UTF-8"
        })
    })
     
    // this.isLoading.state ||= true
    
    window.fetch(request).then(async response => {
        const html = await response.text()
        const parser = new DOMParser()
    
        const document = parser.parseFromString(html, 'text/html')
        this.cacheResponse(url, document)

        if (callback) callback(url, document)
    })
    .catch(error => {
        console.warn('(ERROR) Parse document:', error)
        this.options.onError(this, url)
    })
    .finally(() => {
        // this.isLoading.state ||= false
    })
}

/**
 * 
 * 
 * @param {string} url 
 * @param {boolean} updateHistory 
 * @param {Object} historyState
 * 
 * @private 
 */
Pathway.prototype.navigate = function (url, updateHistory, historyState) {
    if (this.isLoading.state) return

    this.options.onStart(this, url)
    const data = this.cache.get(url)

    setTimeout(async () => {
        this.options.onBeforeLeave(this, url)
        
        const contentData = data || await this.waitFetch(url, updateHistory)
        this.updateDocument(contentData, updateHistory, historyState)

    }, this.options.transitionDuration)
}

/**
 * Update the document with the newly received data and update the router object
 * 
 * @param {CacheState} data 
 * @param {boolean} updateHistory 
 * @param {Object} historyState
 * 
 * @private
 */
Pathway.prototype.updateDocument = function (data, updateHistory, historyState) {
    if (updateHistory) {
        window.history.pushState(historyState, null, data.url)
    }

    this.history.splice(0, this.history.length - this.options.historyStackSize)
    this.history.push({ url: data.url, title: data.title, state: historyState })

    document.title = data.title

    this.mutation.observer.observe(this.container.parentElement, { childList: true })
    this.options.onBeforeRender(this, data.url)
    
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

        if (this.options.cacheLinkSelector) {
            this.cacheContainerLinks()
        }

        observer.disconnect()

        break
    }
}

/**
 * Handles the loading state proxy
 * 
 * @private
 */
Pathway.prototype.proxyHandler = function (callback) {

    return {
        set(target, property, value, receiver) {
            if (value === target[property]) return false

            target[property] = value
            callback(value)

            return true
        }
    }
}

/**
 * Waiting for the fetch to resolve and the data to be cached
 * 
 * @param {string} url 
 * @param {boolean} updateHistory 
 * 
 * @returns {Promise}
 * @private 
 */
Pathway.prototype.waitFetch = function (url, updateHistory) {
    return new Promise(resolve => this.fetchLink(url, updateHistory, resolve)).then(url => {
        return this.__get(url)
    })
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