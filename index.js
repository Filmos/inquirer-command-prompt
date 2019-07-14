const util = require('util')
const chalk = require('chalk')
const ellipsize = require('ellipsize')

const InputPrompt = require('inquirer/lib/prompts/input')

const histories = {}
const historyIndexes = {}

let context
function deChalk(inp) {return inp.replace(/\033.+?m/g,"")}
class CommandPrompt extends InputPrompt {

  handleAutocomplete() {
    this.ghostSuffix = ""
    var lineLength = deChalk(this.opt.prefix).length
                   + deChalk(this.opt.message).length
                   + (this.opt.transformer?
                     deChalk(this.opt.transformer(this.rl.line)).length
                   - deChalk(this.rl.line).length
                     :0)
                   + 2

    if(this.opt.autocompleteStyle == "inline" || this.opt.autocompleteStyle == "multiline") {
      let line = this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ')
      try {
        var ac = this.currentAutoCompleter(line)
        if (ac.match && ac.match!=line) this.ghostSuffix = ac.match.slice(line.length)+this.getSuffix(0,0,ac.match,ac.match)
        else if (ac.matches && this.opt.autocompleteStyle == "multiline" && (this.opt.autocompleteMaxOptions == -1 || ac.matches.length<=(this.opt.autocompleteMaxOptions || 30))) {
          var matches = this.opt.short
              ? this.short(line, ac.matches)
              : ac.matches
          if(this.selectedComplete == undefined || this.selectedComplete >= matches.length) this.selectedComplete = 0
          var sel = this.selectedComplete
          let shortCorrect = ac.matches[sel].length-matches[sel].length

          this.ghostSuffix = matches[sel].slice(line.length-shortCorrect)+this.getSuffix(0,sel,matches[sel],ac.matches[sel])
          for(var i=0;i<Math.min(matches.length-1, 6);i++) {
            let m = sel+i+1
            if(m>=matches.length) m-=matches.length

            let prefix = ""
            let suffix = ""
            if(i==5 && matches.length>6) {prefix = this.getPrefix(i+1,m,"...","..."); suffix = this.getSuffix(i+1,m,"...","...")}
            else {prefix = this.getPrefix(i+1,m,matches[m],ac.matches[m]); suffix = this.getSuffix(i+1,m,matches[m],ac.matches[m])}

            if(prefix.length > lineLength+shortCorrect) prefix = prefix.slice(0,lineLength+shortCorrect)
            // if(suffix.length > lineLength+shortCorrect) prefix = prefix.slice(0,lineLength+shortCorrect)

            this.ghostSuffix += "\n" + prefix + " ".repeat(lineLength+shortCorrect-prefix.length)
            if(i==5 && matches.length>6)  this.ghostSuffix += "..."
            else this.ghostSuffix += matches[m]
            this.ghostSuffix += suffix
          }
        }
      } catch (err) {
        console.error(err)
        rewrite(line)
      }
    }
  }
  getPrefix(line, matchNum, match, fullMatch) {
    let o = this.opt.autocompletePrefix
    if(o == undefined) return ""
    if(typeof o === 'string' || o instanceof String) return o
    return o(line, this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' '),
             matchNum, match, fullMatch)
  }
  getSuffix(line, matchNum, match, fullMatch) {
    let o = this.opt.autocompleteSuffix
    if(o == undefined) return ""
    if(typeof o === 'string' || o instanceof String) return o
    return o(line, this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' '),
             matchNum, match, fullMatch)
  }
  addToHistory(context, value) {
    this.initHistory(context, this.opt.historyFilter)
    let newValue = value
    if(this.opt.historyFilter != undefined) newValue = this.opt.historyFilter(newValue)
    if(newValue !== null && newValue !== undefined) {
      histories[context].push(newValue)
      historyIndexes[context] = histories[context].length
    }
  }
  short(l, m) {
    var defFunction = (l, m) => {
      if (l) {
        l = l.replace(/ $/, '')
        for (let i = 0; i < m.length; i++) {
          if (m[i] == l) {
            m.splice(i, 1)
            i--
          } else {
            let escL = l.replace(/[?+.\\\[\]()^$*|{}]/g, "\\$&")
            if (m[i][l.length] == ' ') {
              m[i] = m[i].replace(RegExp(escL + ' '), '')
            } else {
              m[i] = m[i].replace(RegExp(escL.replace(/ [^ ]+$/, '') + ' '), '')
            }
          }
        }
      }
      return m
    }
    if(this.opt.autocompleteShortener == undefined)
      return defFunction(l, m.slice(0))
    else
      return this.opt.autocompleteShortener(l, m.slice(0), defFunction)
  }
  autoCompleter(line, cmds) {

    let max = 0
    if (typeof cmds === 'function') {
      cmds = cmds(line)
    }

    // first element in cmds can be an object with special instructions
    let options = {
      filter: str => str
    }
    if (typeof cmds[0] === 'object') {
      const f = cmds[0].filter
      if (typeof f === 'function') {
        options.filter = f
      }
      cmds = cmds.slice(1)
    }

    cmds = cmds.reduce((sum, el) => {
      var lineEscaped = line.replace(/[?+.\\\[\]()^$*|{}]/g, "\\$&")
      RegExp(`^${lineEscaped}`,(this.opt.autocompleteIgnoreCase?"i":"")).test(el) && sum.push(el) && (max = Math.max(max, el.length))
      return sum
    }, [])

    if (cmds.length > 1) {
      let commonStr = ''
      LOOP: for (let i = line.length; i < max; i++) {
        let c = null
        for (let l of cmds) {
          let cL = l[i]
          let iC = this.opt.autocompleteIgnoreCase
          if(iC == true && cL) cL = cL.toLowerCase()
          if (!l[i]) {
            break LOOP
          } else if (!c) {
            c = l[i]
          } else if (c !== l[i] && c.toLowerCase() === cL && iC) {
            c = cL
          } else if (c.toLowerCase() !== cL || (!iC && c !== cL)) {
            break LOOP
          }
        }
        commonStr += c
      }
      if (commonStr) {
        return {match: options.filter(line + commonStr)}
      } else {
        return {matches: cmds}
      }
    } else if (cmds.length === 1) {
      return {match: options.filter(cmds[0])}
    } else {
      return {match: options.filter(line)}
    }
  }
  formatList(elems, maxSize = 40, ellipsized) {
    let prefLen = deChalk(this.getPrefix(1)).length
    const cols = process.stdout.columns
    let max = 4
    for (let elem of elems) {
      max = Math.max(max, deChalk(elem).length+4)
    }
    if (ellipsized && max > maxSize) {
      max = maxSize
    }
    if(prefLen+max-4 > cols) prefLen = 0
    prefLen %= max
    let columns = ((cols-prefLen-max+4) / max + 1) | 0
    let str = ''
    let c = 1
    let r = 1
    let suffix = ""
    for (let elem in elems) {
      if(c == 1) {
        let curPrefix = this.getPrefix(r)
        let dcPrefix = deChalk(curPrefix).length
        if(dcPrefix<=prefLen+max*(columns-1)) {
          if(prefLen>=dcPrefix) str += curPrefix + " ".repeat(prefLen-dcPrefix)
          else {
            c += Math.ceil((dcPrefix-prefLen)/max)
            str += curPrefix + " ".repeat(prefLen+max*(c-1)-dcPrefix)
          }
        } else dcPrefix = 0

        suffix = this.getSuffix(r)
        let dcSuffix = deChalk(suffix).length
        if(dcPrefix+dcSuffix<=prefLen+max*(columns-1)) {
          c += Math.ceil(dcSuffix/max)
        } else suffix = ""
      }
      let spacedElem = elems[elem]
      if (c !== columns && elem!=elems.length-1) spacedElem = CommandPrompt.setSpaces(spacedElem, max, ellipsized)
      if(this.opt.autocompleteColor != undefined) spacedElem = this.opt.autocompleteColor(spacedElem)
      str += spacedElem
      if (c === columns) {
        str += suffix
        if(elem!=elems.length-1) str += '\n'//' '.repeat(cols - max * columns)
        c = 1
        r++
      } else {
        c++
        if(elem==elems.length-1) str += suffix
      }
    }
    return str
  }

  initHistory(context, historyFilter) {
    if (!histories[context]) {
      histories[context] = []
      historyIndexes[context] = 0
    }
  }
  initAutoCompletion(autoCompletion) {
    if (autoCompletion) {
      this.currentAutoCompleter = (l) => this.autoCompleter(l, autoCompletion)
    } else {
      this.currentAutoCompleter = () => []
    }
  }
  initSuffixes() {
    this.trueRender = this.render
    this.render = function() {
      var lineLength = deChalk(this.opt.prefix).length
                     + deChalk(this.opt.message).length
                     + (this.opt.transformer?
                       deChalk(this.opt.transformer(this.rl.line)).length
                     - deChalk(this.rl.line).length
                       :0)
                     + 2

      if(this.ghostSuffix == "") this.trueRender()
      else { /* Displays a suffix which isn't included in the input result */
        var origLine = this.rl.line
        var formattedSuffix = (this.opt.autocompleteColor || chalk.grey)(this.ghostSuffix)
        this.rl.line+=formattedSuffix

        var origTrans = this.opt.transformer
        if(origTrans != undefined)
          this.opt.transformer = () => {return origTrans(origLine)+formattedSuffix}

        this.trueRender()

        if(origTrans != undefined)
          this.opt.transformer = origTrans
        this.rl.line = origLine

        process.stdout.moveCursor(
          Math.min(formattedSuffix.length-deChalk(formattedSuffix).length,lineLength),
          -formattedSuffix.split("\n").length + 1)
        this.linesToSkip = formattedSuffix.split("\n").length - 1
      }
    }
  }

  run() {
    this.initHistory(context, this.opt.historyFilter)
    this.initAutoCompletion(this.opt.autoCompletion)
    this.handleAutocomplete()
    this.initSuffixes()
    return new Promise(function (resolve) {
      if(this._onEnd == undefined) {
        this._onEnd = this.onEnd
        this.onEnd = (s) => {
          if(this.linesToSkip != undefined) {
            process.stdout.moveCursor(0,this.linesToSkip)
            this.linesToSkip = 0
          }
          this._onEnd(s)
        }
      }
      this._run(function (value) {
        this.addToHistory(context, value)
        resolve(value)
      })
    }.bind(this))
  }
  onKeypress(e) {

    const rewrite = line => {
      this.rl.line = line
      this.rl.write(null, {ctrl: true, name: 'e'})
    }

    if(this.linesToSkip != undefined) {
      process.stdout.moveCursor(0,this.linesToSkip)
      this.linesToSkip = 0
    }

    context = this.opt.context ? this.opt.context : '_default'

    /** go up commands history */
    if (e.key.name === 'up') {

      if (historyIndexes[context] > 0) {
        historyIndexes[context]--
        rewrite(histories[context][historyIndexes[context]])
      }
    }
    /** go down commands history or clear input field if there is no newer entry */
    else if (e.key.name === 'down') {
      if (histories[context][historyIndexes[context] + 1]) {
        historyIndexes[context]++
        rewrite(histories[context][historyIndexes[context]])
      } else {
        historyIndexes[context] = histories[context].length
        rewrite("")
      }
    }
    /** search for command at an autoComplete option
     * which can be an array or a function which returns an array
     * */
    else if (e.key.name === 'tab' || (e.key.name === "right" && e.key.shift && this.opt.autocompleteStyle == "multiline")) {
      let line = this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ')
      try {
        var ac = this.currentAutoCompleter(line)
        if (ac.match) {
          rewrite(ac.match)
        } else if (ac.matches
               && (this.opt.autocompleteStyle == "list" || this.opt.autocompleteStyle == undefined)
               && ((this.opt.autocompleteMaxOptions || -1) == -1 || ac.matches.length<=this.opt.autocompleteMaxOptions)) {
          console.log()
          process.stdout.cursorTo(0)
          console.log(this.getPrefix(0) + chalk.red('>> ') + chalk.grey('Available commands:') + this.getSuffix(0))
          console.log(this.formatList(
              this.opt.short
                  ? this.short(line, ac.matches)
                  : ac.matches
          ))
          rewrite(line)
        } else if(ac.matches && this.opt.autocompleteStyle == "multiline") {
          if(e.key.shift) {
            if(this.selectedComplete == undefined || this.selectedComplete >= ac.matches.length) this.selectedComplete = 0
            rewrite(ac.matches[this.selectedComplete])
          } else {
            if(this.selectedComplete == undefined || this.selectedComplete >= ac.matches.length-1) this.selectedComplete = 0
            else this.selectedComplete++
            rewrite(line)
          }
        }
      } catch (err) {
        console.error(err)
        rewrite(line)
      }
    }

    this.handleAutocomplete()
    this.render()
  }

}



CommandPrompt.setSpaces = (str, length, ellipsized) => {
  if (ellipsized && str.length > length - 4) {
    return ellipsize(str, length - 4) + ' '.repeat(4)
  }
  const newStr = str + ' '.repeat(length - str.length)
  return newStr
}


module.exports = CommandPrompt
