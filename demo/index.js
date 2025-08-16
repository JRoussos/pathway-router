window.pathway = new Pathway({ 
    containerSelector:  '.mainContent',
    transitionDuration: 300,
    historyStackSize:   3,
    cacheLinkSelector:  null,
    cacheCapacity:      1,
    scrollRestoration:  true,
    onNavigate: () => {
        document.querySelector(':root').classList.add('fade')
    },
    onBeforeLeave: router => {
        // console.log(props, url);
    },
    onBeforeRender: router => {
        // console.log(router.history);
        document.querySelector(':root').classList.remove('fade')
    },
    onLoadingChange: state => {
        // console.log(state);
        // document.querySelector(':root').classList.toggle('fade', state)
    }
})

console.log(window.pathway)