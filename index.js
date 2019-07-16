const util = require('util')
const chalk = require('chalk')
const ellipsize = require('ellipsize')

const InputPrompt = require('inquirer/lib/prompts/input')

const histories = {}
const historyIndexes = {}

function deChalk(inp) {return inp.replace(/\033.+?m/g,"")}
function short(l, m) {
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
    let line = this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ')
    var ac = this.currentAutoCompleter(line)

    if(ac.style == "inline" || ac.style == "multiline") {
      try {
        if (ac.match && ac.match!=line && ac.filter(ac.match)!=line) {
          this.ghostSuffix = ac.color(ac.match.slice(line.length)+ac.suffix(0,0,ac.match,ac.match))
        } else if (ac.matches && ac.style == "multiline") {
          var matches = ac.matchesShortened(line)
          if(this.selectedCompletion == undefined || this.selectedCompletion >= matches.length) this.selectedCompletion = 0
          var sel = this.selectedCompletion
          let shortCorrect = ac.matches[sel].length-matches[sel].length

          this.ghostSuffix = matches[sel].slice(line.length-shortCorrect)+ac.suffix(0,sel,matches[sel],ac.matches[sel])
          for(var i=0;i<Math.min(matches.length-1, 6);i++) {
            let m = sel+i+1
            if(m>=matches.length) m-=matches.length

            let prefix = ""
            let suffix = ""
            if(i==5 && matches.length>6) {prefix = ac.prefix(i+1,m,"...","..."); suffix = ac.suffix(i+1,m,"...","...")}
            else {prefix = ac.prefix(i+1,m,matches[m],ac.matches[m]); suffix = ac.suffix(i+1,m,matches[m],ac.matches[m])}

            if(prefix.length > lineLength+shortCorrect) prefix = prefix.slice(0,lineLength+shortCorrect)
            // if(suffix.length > lineLength+shortCorrect) prefix = prefix.slice(0,lineLength+shortCorrect)

            this.ghostSuffix += "\n" + prefix + " ".repeat(lineLength+shortCorrect-prefix.length)
            if(i==5 && matches.length>6)  this.ghostSuffix += "..."
            else this.ghostSuffix += matches[m]
            this.ghostSuffix += suffix
          }
          this.ghostSuffix = ac.color(this.ghostSuffix)
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
  autoCompleter(line, cmds) {
    // Handle retrieving autocomplete array and options object
    let max = 0
    if (typeof cmds === 'function') {
      cmds = cmds(line)
    }
    let options = { // Default values
      filter: str => str,
      ignoreCase: false,
      short: false,
      shortener: short,
      style: "list",
      prefix: () => "",
      suffix: () => ""
    }
    // first element in cmds can be an object with special instructions
    if (typeof cmds[0] === 'object') {
      options = {...options, ...cmds[0]}
      cmds = cmds.slice(1)
    }
    if(!options.color)
      options.color = (options.style == 'list'?
                          str=>str:
                          chalk.grey)
    if(!options.maxOptions)
      options.maxOptions = (options.style == 'list'?
                              -1:
                              30)
    for(let v of ["prefix","suffix"]) {
      let oldVal = options[v]
      if(typeof options[v] === 'string' || options[v] instanceof String) options[v] = () => oldVal
      else options[v] = (line, matchNum, match, fullMatch) => {
      return oldVal(line, this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' '),
                    matchNum, match, fullMatch)
      }
    }

    // Handle autocompletion
    cmds = cmds.reduce((sum, el, i, arr) => {
      var lineEscaped = line.replace(/[?+.\\\[\]()^$*|{}]/g, "\\$&")
      RegExp(`^${lineEscaped}`,(options.ignoreCase?"i":"")).test(el) && sum.push(el) && (max = Math.max(max, el.length))
      return sum
    }, [])

    if (cmds.length > 1) {
      let commonStr = ''
      LOOP: for (let i = line.length; i < max; i++) {
        let c = null
        for (let l of cmds) {
          let cL = l[i]
          if(options.ignoreCase == true && cL) cL = cL.toLowerCase()
          if (!l[i]) {
            break LOOP
          } else if (!c) {
            c = l[i]
          } else if (c !== l[i] && c.toLowerCase() === cL && options.ignoreCase) {
            c = cL
          } else if (c.toLowerCase() !== cL || (!options.ignoreCase && c !== cL)) {
            break LOOP
          }
        }
        commonStr += c
      }
      if (commonStr) {
        options["match"] = line + commonStr
      } else if(options.maxOptions == -1 || cmds.length <= options.maxOptions) {
        options["matches"] = cmds
      }
    } else if (cmds.length === 1) {
      options["match"] = cmds[0]
    } else {
      options["match"] = line
    }

    // Handle advanced options, such as lazy shorteners
    if(options["matches"])
      options["matchesShortened"] = (line) => {
        if(options.short == false) return options["matches"]
        return options.shortener(line, options["matches"].slice(0), short)
      }
    return options
  }
  formatList(elems, options, maxSize = 40, ellipsized) {
    let prefLen = deChalk(options.prefix(1)).length
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
        let curPrefix = options.prefix(r)
        let dcPrefix = deChalk(curPrefix).length
        if(dcPrefix<=prefLen+max*(columns-1)) {
          if(prefLen>=dcPrefix) str += curPrefix + " ".repeat(prefLen-dcPrefix)
          else {
            c += Math.ceil((dcPrefix-prefLen)/max)
            str += curPrefix + " ".repeat(prefLen+max*(c-1)-dcPrefix)
          }
        } else dcPrefix = 0

        suffix = options.suffix(r)
        let dcSuffix = deChalk(suffix).length
        if(dcPrefix+dcSuffix<=prefLen+max*(columns-1)) {
          c += Math.ceil(dcSuffix/max)
        } else suffix = ""
      }
      let spacedElem = elems[elem]
      if (c !== columns && elem!=elems.length-1) spacedElem = CommandPrompt.setSpaces(spacedElem, max, ellipsized)
      if(options.color != undefined) spacedElem = options.color(spacedElem)
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
                     + (this.opt.transformer
                     ? deChalk(this.opt.transformer(this.rl.line)).length
                     : deChalk(this.rl.line).length)
                     + 2

      if(!this.ghostSuffix) this.trueRender()
      else { /* Displays a suffix which isn't included in the input result */
        var origTrans = this.opt.transformer
        if(!origTrans) this.opt.transformer = (o) => {return o+this.ghostSuffix}
        else this.opt.transformer = (o) => {return origTrans(o)+this.ghostSuffix}
        this.trueRender()
        this.opt.transformer = origTrans

        let splitSuffix = this.ghostSuffix.split("\n")
        process.stdout.cursorTo(lineLength)
        process.stdout.moveCursor(0,-splitSuffix.length + 1)
        this.linesToSkip = splitSuffix.length - 1
      }
    }
  }

  run() {
    let context = this.opt.context ? this.opt.context : '_default'
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
          this.render = this.trueRender
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

    let context = this.opt.context ? this.opt.context : '_default'

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
    else if (e.key.name === 'tab' || (e.key.name === "right" && e.key.shift)) {
      let line = this.rl.line.replace(/^ +/, '').replace(/\t/, '').replace(/ +/g, ' ')
      try {
        var ac = this.currentAutoCompleter(line)
        if (ac.match) {
          rewrite(ac.filter(ac.match))
        } else if (ac.matches && ac.style == "list") {
          console.log()
          process.stdout.cursorTo(0)
          console.log(ac.prefix(0) + chalk.red('>> ') + chalk.grey('Available commands:') + ac.suffix(0))
          console.log(this.formatList(ac.matchesShortened(line), ac))
          rewrite(line)
        } else if(ac.matches && ac.style == "multiline") {
          if(e.key.shift) {
            if(this.selectedCompletion == undefined || this.selectedCompletion >= ac.matches.length) this.selectedCompletion = 0
            rewrite(ac.filter(ac.matches[this.selectedCompletion]))
          } else {
            if(this.selectedCompletion == undefined || this.selectedCompletion >= ac.matches.length-1) this.selectedCompletion = 0
            else this.selectedCompletion++
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
