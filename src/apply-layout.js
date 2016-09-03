import {matchesSelector} from "./matches-selector"
import {ContentCutter} from "./cut-content"
import {PageCounterArab, PageCounterRoman} from "./page-counters"
import {createToc} from "./create-toc"

export class LayoutApplier {

    constructor(configValues) {
        this.configValues = configValues
        this.bodyFlowObjects = []
        //this.currentChapter = false
        //this.currentSection = false
        this.currentFragment = -1

        this.events = {
            /* layoutFlowFinished is emitted the first time the flow of the entire book has
             * been created.
             */
            layoutFlowFinished: document.createEvent('Event')
        }

        this.events.layoutFlowFinished.initEvent(
            'layoutFlowFinished',
            true,
            true)

        /* pageCounters contains all the page counters we use in a book --
         * typically these are two -- roman for the frontmatter and arab for the main
         * body contents.
         */
        this.pageCounters = {
            arab: new PageCounterArab(),
            roman: new PageCounterRoman()
        }

        this.cutter = new ContentCutter(configValues)

    }

    config(configKey) {
        /* Return configuration variables or false.
         */
        if (this.configValues.hasOwnProperty(configKey)) {
            return this.configValues[configKey]
        } else {
            return false
        }
    }


    initiate() {
        // Create div for layout
        let layoutDiv = document.createElement('div'),
            flowedElement = eval(this.config('flowElement')),
            chapterStartSelector = this.config(
                'chapterStartMarker'),
            sectionStartSelector = this.config(
                'sectionStartMarker'),
            dividerSelector = chapterStartSelector + ',' + sectionStartSelector,
            dividers = flowedElement.querySelectorAll(dividerSelector),
            range = document.createRange(), nextChapter = false,
            nextSection = false,
            flowTo = eval(this.config('flowTo'))

        layoutDiv.id = 'pagination-layout'
        for (let i = 0; i < dividers.length; i++) {
            let flowObject = {
                chapter: false,
                section: false
            }
            if (nextChapter) {
                flowObject.chapter = nextChapter
                nextChapter = false
            }
            if (nextSection) {
                flowObject.section = nextSection
                nextSection = false
            }
            range.setStart(flowedElement.firstChild, 0)
            range.setEnd(dividers[i], 0)
            flowObject.fragment = range.extractContents()
            this.bodyFlowObjects.push(flowObject)

            let extraElement = flowObject.fragment.querySelectorAll(
                dividerSelector)[1]
            if (extraElement && extraElement.parentElement) {
                extraElement.parentElement.removeChild(extraElement)
            }
            if (matchesSelector(dividers[i],
                    chapterStartSelector)) {
                let tempNode = flowedElement.querySelector(this.config(
                    'chapterTitleMarker'))
                if (!tempNode) {
                    tempNode = document.createElement('div')
                }
                tempNode = tempNode.cloneNode(true)
                nextChapter = document.createDocumentFragment()
                while (tempNode.firstChild) {
                    nextChapter.appendChild(tempNode.firstChild)
                }
            } else {
                let tempNode = flowedElement.querySelector(this.config(
                    'sectionTitleMarker')).cloneNode(true)
                nextSection = document.createDocumentFragment()
                while (tempNode.firstChild) {
                    nextSection.appendChild(tempNode.firstChild)
                }
            }

            if (i === 0) {
                if (flowObject.fragment.textContent.trim().length ===
                    0 && flowObject.fragment.querySelectorAll(
                        'img,svg,canvas,hr').length === 0) {
                    this.bodyFlowObjects.pop()
                }
            }
        }

        let flowObject = {
            chapter: false,
            section: false
        }
        if (nextChapter) {
            flowObject.chapter = nextChapter
        }
        if (nextSection) {
            flowObject.section = nextSection
        }

        flowObject.fragment = document.createDocumentFragment()

        while (flowedElement.firstChild) {
            flowObject.fragment.appendChild(flowedElement.firstChild)
        }


        this.bodyFlowObjects.push(flowObject)

        flowTo.appendChild(layoutDiv)

        this.paginateDivision(layoutDiv, 'arab')

    }

    paginateDivision(layoutDiv, pageCounterStyle) {
        if (++this.currentFragment < this.bodyFlowObjects.length) {
            let newContainer = document.createElement('div')
            layoutDiv.appendChild(newContainer)
            newContainer.classList.add('pagination-body')
            newContainer.classList.add('pagination-body-' + this.currentFragment)
            if (this.bodyFlowObjects[this.currentFragment].section) {
                this.currentSection = this.bodyFlowObjects[
                    this.currentFragment].section
                newContainer.classList.add('pagination-section')
            }
            if (this.bodyFlowObjects[this.currentFragment].chapter) {
                this.currentChapter = this.bodyFlowObjects[
                    this.currentFragment].chapter
                newContainer.classList.add('pagination-chapter')
            }
            this.flowElement(this.bodyFlowObjects[
                    this.currentFragment].fragment,
                newContainer, pageCounterStyle, this.bodyFlowObjects[
                    this.currentFragment].section,
                this.bodyFlowObjects[this.currentFragment].chapter
            )
        } else {
            this.currentChapter = false
            this.currentSection = false
            this.pageCounters[pageCounterStyle].numberPages()
            if (this.config('enableFrontmatter')) {
                layoutDiv.insertBefore(document.createElement('div'),
                    layoutDiv.firstChild)
                layoutDiv.firstChild.classList.add(
                    'pagination-frontmatter')
                let tempNode = document.createElement('div')
                tempNode.innerHTML = this.config(
                    'frontmatterContents')
                let flowObject = {
                    fragment: document.createDocumentFragment()
                }
                while (tempNode.firstChild) {
                    flowObject.fragment.appendChild(tempNode.firstChild)
                }
                if (this.config('numberPages')) {
                    flowObject.fragment.appendChild(createToc())
                }
                this.flowElement(flowObject.fragment, layoutDiv.firstChild,
                    'roman')
            }
            window.scrollTo(0, 0)
        }

    }

    fillPage(node, container, pageCounterStyle) {

        let lastPage = this.createPage(container, pageCounterStyle),
            clonedNode = node.cloneNode(true),
            footnoteSelector = this.config('footnoteSelector'),
            topfloatSelector = this.config('topfloatSelector'),
            that = this

        lastPage.appendChild(node)

        let overflow = this.cutter.cutToFit(lastPage)

        let topfloatsLength = lastPage.querySelectorAll(topfloatSelector).length

        if (topfloatsLength > 0) {
            let topfloats = clonedNode.querySelectorAll(topfloatSelector)

            for (let i = 0; i < topfloatsLength; i++) {
                while (topfloats[i].firstChild) {
                    lastPage.previousSibling.appendChild(topfloats[i].firstChild)
                }

            }
            while (lastPage.firstChild) {
                lastPage.removeChild(lastPage.firstChild)
            }
            node = clonedNode.cloneNode(true)
            lastPage.appendChild(node)
            overflow = this.cutter.cutToFit(lastPage)
        }

        let footnotes = lastPage.querySelectorAll(footnoteSelector)
        let footnotesLength = footnotes.length
        if (footnotesLength > 0) {

            while (lastPage.nextSibling.firstChild) {
                lastPage.nextSibling.removeChild(lastPage.nextSibling.firstChild)
            }

            for (let i = 0; i < footnotesLength; i++) {
                let clonedFootnote = footnotes[i].cloneNode(true)
                lastPage.nextSibling.appendChild(clonedFootnote)
            }

            while (lastPage.firstChild) {
                lastPage.removeChild(lastPage.firstChild)
            }

            lastPage.appendChild(clonedNode)

            overflow = this.cutter.cutToFit(lastPage)
            for (let i = lastPage.querySelectorAll(footnoteSelector).length; i <
                footnotesLength; i++) {
                let oldFn = lastPage.nextSibling.children[i]

                while (oldFn.firstChild) {
                    oldFn.removeChild(oldFn.firstChild)
                }
            }
        }


        if (overflow.firstChild && overflow.firstChild.textContent.trim()
            .length === 0 && ['P','DIV'].indexOf(overflow.firstChild.nodeName) !== -1) {
            overflow.removeChild(overflow.firstChild)
        }

        if (lastPage.firstChild &&
            lastPage.firstChild.nodeType != 3 &&
            lastPage.firstChild.textContent.trim().length === 0 &&
            lastPage.firstChild.querySelectorAll('img,svg,canvas').length ===
            0) {
            lastPage.removeChild(lastPage.firstChild)


        } else if (overflow.firstChild && lastPage.firstChild) {
            setTimeout(function() {
                that.fillPage(overflow, container,
                    pageCounterStyle)
            }, 1)
        } else {
            this.finish(container, pageCounterStyle)
        }
    }

    createPage(container, pageCounterClass) {
        let page = document.createElement('div'),
            contentsContainer = document.createElement('div'),
            mainContentsContainer = document.createElement('div'),
            topfloats = document.createElement('div'),
            contents = document.createElement('div'),
            footnotes = document.createElement('div')


        page.classList.add('pagination-page')
        contentsContainer.classList.add('pagination-contents-container')
        mainContentsContainer.classList.add(
            'pagination-main-contents-container')

        if (this.currentChapter || this.currentSection) {

            let header = document.createElement('div')

            header.classList.add('pagination-header')

            if (this.currentChapter) {

                let chapterHeader = document.createElement('span')

                chapterHeader.classList.add('pagination-header-chapter')
                chapterHeader.appendChild(this.currentChapter.cloneNode(
                    true))
                header.appendChild(chapterHeader)
            }

            if (this.currentSection) {

                let sectionHeader = document.createElement('span')
                sectionHeader.classList.add('pagination-header-section')
                sectionHeader.appendChild(this.currentSection.cloneNode(
                    true))
                header.appendChild(sectionHeader)
            }
            page.appendChild(header)
        }

        topfloats.classList.add('pagination-topfloats')
        //topfloats.appendChild(document.createElement('p'))

        contents.classList.add('pagination-contents')

        footnotes.classList.add('pagination-footnotes')
        footnotes.appendChild(document.createElement('p'))

        mainContentsContainer.appendChild(topfloats)
        mainContentsContainer.appendChild(contents)
        mainContentsContainer.appendChild(footnotes)

        page.appendChild(mainContentsContainer)

        if (this.config('numberPages')) {

            let pagenumberField = document.createElement('div')
            pagenumberField.classList.add('pagination-pagenumber')
            pagenumberField.classList.add('pagination-' +
                pageCounterClass)

            page.appendChild(pagenumberField)
        }

        container.appendChild(page)
        return contents
    }

    flowElement(overflow, container, pageCounterStyle) {
        let that = this
        setTimeout(function() {
            that.fillPage(overflow, container,
                pageCounterStyle)
        }, 1)
    }

    finish(container, pageCounterStyle) {
        let layoutDiv = container.parentElement
        if (this.config('alwaysEven') && container.querySelectorAll(
                '.pagination-page').length % 2 === 1) {
            this.createPage(container, pageCounterStyle)
        }
        if (container.classList.contains('pagination-body')) {
            this.paginateDivision(layoutDiv, pageCounterStyle)
        } else {
            window.scrollTo(0, 0)
            this.pageCounters[pageCounterStyle].numberPages()
            document.dispatchEvent(this.events.layoutFlowFinished)
        }
    }

}
