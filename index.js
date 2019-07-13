const util = require('util')
const chalk = require('chalk')
const ellipsize = require('ellipsize')

const InputPrompt = require('inquirer/lib/prompts/input')

const histories = {}
const historyIndexes = {}

let context
function deChalk(inp) {return inp.replace(/\033.+?m/g,"")}
class CommandPrompt extends InputPrompt {


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
        if (ac.match) {
          this.ghostSuffix = ac.match.slice(line.length)
        } else if (ac.matches && this.opt.autocompleteStyle == "multiline" && (this.opt.autocompleteMaxOptions == -1 || ac.matches.length<=(this.opt.autocompleteMaxOptions || 30))) {
          var matches = this.opt.short
              ? this.short(line, ac.matches)
              : ac.matches
          if(this.selectedComplete == undefined || this.selectedComplete >= matches.length) this.selectedComplete = 0
          var sel = this.selectedComplete
          var prefix = this.opt.autocompletePrefix || ""
          var shortCorrect = ac.matches[sel].length-matches[sel].length

          this.ghostSuffix = matches[sel].slice(line.length-shortCorrect)
          matches = matches.slice(sel+1).concat(matches.slice(0, sel))
          for(var i=0;i<Math.min(matches.length, 6);i++) {
            if(i==5 && matches.length>6) this.ghostSuffix += "\n" + prefix + " ".repeat(lineLength+shortCorrect-prefix.length) + "..."
            else this.ghostSuffix += "\n" + prefix + " ".repeat(lineLength+shortCorrect-prefix.length) + matches[i]
          }
        }
      } catch (err) {
        console.error(err)
        rewrite(line)
      }
    }
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
          var prefix = this.opt.autocompletePrefix || ""
          console.log(prefix + chalk.red('>> ') + chalk.grey('Available commands:'))
          console.log(this.formatList(
              this.opt.short
                  ? this.short(line, ac.matches)
                  : ac.matches,
              prefix
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

  formatList(elems, prefix="", maxSize = 40, ellipsized) {
    const cols = process.stdout.columns-prefix.length
    let max = 0
    for (let elem of elems) {
      max = Math.max(max, elem.length + 4)
    }
    if (ellipsized && max > maxSize) {
      max = maxSize
    }
    let columns = (cols / max) | 0
    let str = ''
    let c = 1
    for (let elem of elems) {
      let spacedElem = CommandPrompt.setSpaces(elem, max, ellipsized)
      if(this.opt.autocompleteColor != undefined) spacedElem = this.opt.autocompleteColor(spacedElem)
      str += (c==1?prefix:"") + spacedElem
      if (c === columns) {
        str += '\n'//' '.repeat(cols - max * columns)
        c = 1
      } else {
        c++
      }
    }
    return str
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
