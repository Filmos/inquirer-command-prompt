# inquirer-command-prompt
A prompt with history management and

## Installation

```
npm install inquirer-command-prompt --save
```

## Usage

```javascript
inquirer.registerPrompt('command', require('inquirer-command-prompt'))
```
You can change the type `command` with whatever you like, the prompt is anonymous.

## Example


```javascript
  return inquirer.prompt([
      {
        type: 'command',
        name: 'cmd',
        message: '>',
        validate: val => {
          return val
              ? true
              : 'I you don\'t know the available commands, type help for help'
        },
        // optional
        autoCompletion: [{
          color: chalk.grey,
          prefix: function(line,input) {return (line%2==0?"|/| ":"|\\| ")},
          short: false,
        },'ls', 'echo', 'find', 'cat', 'help'],
        context: 0
      }
    ]).then(answers => {
      return Promise.resolve(answers.cmd)
    }).catch(err => {
      console.error(err.stack)
    })
```


### Options

#### autoCompletion

It is optional. It can be an array or a function which returns an array accepting as a parameter the part of the command that's been already typed.

The first element of the array can be an `options` object. There are many properties than can be configured through it. What's more, if you are using a function to as `autoCompletion`, you can change those properties based on current input.

The `options` object can have following properties:

##### filter

This is an optional function that will be applied to the autocomplete suggestion when they are supposed to be written into input. It's a great way to display additional information to the user that doesn't necessary have to be a part of the command.

Suppose that you want to edit something and the available commands are
```
edit 12: Love is in the air
edit 36: Like a virgin
```
The titles of the songs are actually hints, and are not necessary for the command which is supposed to be only `edit 12`. So, you want that when the user presses TAB only `edit 12` is rendered. To obtain this, you can pass the following command list:
```javascript
[
  { filter: str => str.split(':')[0] },
  'edit 12: Love is in the air',
  'edit 36: Like a virgin'
]
```

##### ignoreCase

This is an optional boolean, set to `false` by default. If it is set to `true`, letter casing will be ignored when searching for possible autocompletions.

##### short

The `short` option is optional and by default it is set to `false`. If set to `true` it cuts the suggestion leaving only the part that has not been already typed. For example, if there are the following command available

```javascript
['foo ba', 'foo bb']
```

and you have already typed `foo` it shows just `ba` and `bb` in the suggestions, instead of `foo ba` and `foo bb`

##### shortener

The `shortener` option is optional. It has to be a function accepting two parameters: current input as a string and list of possible matches as an array of string (those matches are already filtered, so the list will only contain autocompletions that match with the current input); and has to output an array of those matches in a shortened version.

This function will replace the default shortening function (which shortens command based on spaces in them) and will be used when the option [`short`](#short) is set to true.

There is also a third, optional parameter. It's a function which normally would be executed as a shortener. It can be used if you only want custom shortening under certain circumstances or if you want to modify matches before passing them for shortening.

An example function may look like this:
```javascript
shortener: function(line, matches, func) {
  if(line[0] === "!") return func(line, matches)
  for(i in matches) matches[i] = matches[i].slice(line.length)
  return matches
}
```

##### style

The `style` option is optional and by default it is set to "list". This option determines which autocomplete interface will be used.

Possible options:

![list](https://i.imgur.com/nljzYl3.png)

![inline](https://i.imgur.com/XFSvmAw.png)

This style will only display autocompletion if there is only one way to autocomplete current input (i.e. there is only one matching result or all matching results have the same prefix).

![multiline](https://i.imgur.com/zEVYTzy.png)

This is an advanced version of the `inline` style. In addition to displaying single autocompletions, it will also display a list of all possible autocompletions in a list below the current line.

Unlike the `list` style, this style won't display any autocompletions if there are more than 30 possibilities without a common prefix (this amount can be configured with [`maxOptions`](#maxOptions)).
Controls are also slightly changed for this style - pressing `tab` will cycle through all options and `shift+right` will complete for the current selection.

---

It is also worth noting that for `inline` and `multiline` styles the autocomplete functions is called whenever any key is pressed (instead of just when the `tab` key is pressed). Therefore if that function takes significant amount of processing power the input may lag.

##### color

This option is optional. It has to be a chalk function which will be used to format autocompletion.

##### maxOptions

It's an optional integer parameter. If there are more possible autocompletions than this number, none of them will be displayed to prevent screen clutter. Setting it to -1 will remove the upper autocompletion limit.

By default it is set to `-1` for `list` style and to `30` for `multiline` style.
Due to the nature of the `inline` style, this option doesn't affect it.

##### prefix

The `prefix` option is optional and by default it is set to an empty string. This is a string that will be added at the beginning of all lines generated by autocomplete (e.g. list of available autocompletions).

This option can also be a function returning string.

This function should accept two parameters:
  * an integer parameter `lineNumber`, which represent the number of line for which prefix should be returned (1-indexed, counting from the top). It is equal to `0` for the `Available commands:` line.
  * a string parameter 'input', which is the part of the command that's been already typed.

If [`style`](#style) is set to `multiline`, the function can accept three additional parameters:
  * an integer parameter `matchNumber`, which represents which match is present in this line (this value changes when the user cycles through autocomplete options). It is also worth noting that the currently selected option is displayed in the same line as the input and no prefix is generated for it.
  * a string parameter `matchValue`, which is equal to the match that is displayed in this line (this value is affected by the [`short`](#short) option). It can also be equal to `...` if it is the last displayed line and there are more matches than can be fit on screen at once.
  * a string parameter 'fullMatchValue', which is equal to the unshortened `matchValue`. If [`short`](#short) is equal to `false`, those two parameters are the same.

##### suffix

This option works exactly like [`prefix`](#prefix), but adds a string to the end of each line of autocompletions. It can also be both a string and a function, and the function parameters are the same as in [`prefix`](#prefix).

It is worth noting that, unlike in [`prefix`](#prefix), suffix can be generated for inline autocompletions, those will have a `lineNumber` equal to `0`.

*If you are using [`multiline`](#style) style, in most cases it is better to use the [filter](#filter) option.*

#### context

The context is important for the history. If you program is handling a specific process you want to have an history of the commands available in that specific context. The `context` can be either a string or an integer.

#### historyFilter

It is optional. It has to be a function which returns a string or a null and accepts as a parameter a string representing last command used (after `filter` command has been applied).

This allows you to modify how commands will be saved into history and what will be typed when you use the up and down arrows (which is especially useful if you are dealing with colors in the `filter` command).

If this function returns null given command isn't saved to the memory at all.

#### inputSuffix

This is an optional option, which can be either a string or a function returning a string and accepting current input as a parameter.

This string will be displayed at the end of user input but won't be included in input result. If there are autocompletions and [`style`](#style) isn't `list`, it will be displayed after the first line of autocompletions.

---

Run the example in `examples/autocompletions.js` to see how the options work.

## Requirements

Starting with version v0.0.7, inquirer-command-prompt requires Node 6+.

## Credits
Francesco Sullo, [Filmos](http://filmos.net/)

## License
MIT
