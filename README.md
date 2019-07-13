# inquirer-command-prompt
A prompt with history management and autocomplete

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
        autoCompletion: ['ls', 'echo', 'find', 'cat', 'help'],
        autocompleteColor: chalk.grey,
        autocompletePrefix: function(l,m) {return (l%2==0?"|/| ":"|\\| ")},
        context: 0,
        short: false
      }
    ]).then(answers => {
      return Promise.resolve(answers.cmd)
    }).catch(err => {
      console.error(err.stack)
    })
```


### Options

#### Autocomplete system:

##### autoCompletion

It is optional. It can be an array or a function which returns an array accepting as a parameter the part of the command that's been already typed.

The first element of the array can be an `options` object. Right now, the only implemented option is `filter`. Suppose that you want to edit something and the available commands are
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

##### autocompleteIgnoreCase

This is an optional boolean, set to `false` by default. If it is set to `true`, letter casing will be ignored when searching for possible autocompletions.

##### short

The `short` option is optional and by default it is set to `false`. If set to `true` it cuts the suggestion leaving only the part that has not been already typed. For example, if there are the following command available

```javascript
['foo ba', 'foo bb']
```

and you have already typed `foo` it shows just `ba` and `bb` in the suggestions, instead of `foo ba` and `foo bb`

##### autocompleteShortener

The `autocompleteShortener` option is optional. It has to be a function accepting two parameters: current input as a string and list of possible matches as an array of string (those matches are already filtered, so the list will only contain autocompletions that match with the current input); and has to output an array of those matches in a shortened version.

This function will replace the default shortening function (which shortens command based on spaces in them) and will be used when the option `short` is set to true.

There is also a third, optional parameter. It's a function which normally would be executed as a shortener. It can be used if you only want custom shortening under certain circumstances or if you want to modify matches before passing them for shortening.

An example function may look like this:
```javascript
autocompleteShortener: function(line, matches, func) {
  if(line[0] === "!") return func(line, matches)
  for(i in matches) matches[i] = matches[i].slice(line.length)
  return matches
}
```

##### autocompleteStyle

The `autocompleteStyle` option is optional and by default it is set to "list". This option determines which autocomplete interface will be used.

Possible options:

![list](https://i.imgur.com/Cp5go6g.png)

![inline](https://i.imgur.com/n8UdcVt.png)

This style will only display autocompletion if there is only one way to autocomplete current input (i.e. there is only one matching result or all matching results have the same prefix).

![multiline](https://i.imgur.com/5ntFsq1.png)

This is an advanced version of the `inline` style. In addition to displaying single autocompletions, it will also display a list of all possible autocompletions in a list below the current line.

Unlike the `list` style, this style won't display any autocompletions if there are more than 30 possibilities without a common prefix (this amount can be configured with `autocompleteMaxOptions`).
Controls are also slightly changed for this style - pressing `tab` will cycle through all options and `shift+right` will complete for the current selection.



It is also worth noting that for `inline` and `multiline` styles the autocomplete functions is called whenever any key is pressed (instead of just when the `tab` key is pressed). Therefore if that function takes significant amount of processing power the input may lag.

##### autocompleteColor

This option is optional. It has to be a chalk function which will be used to format autocompletion.

##### autocompleteMaxOptions

It's an optional integer parameter. If there are more possible autocompletions than this number, none of them will be displayed to prevent screen clutter. Setting it to -1 will remove the upper autocompletion limit.

By default it is set to `-1` for `list` style and to `30` for `multiline` style.
Due to the nature of the `inline` style, this option doesn't affect it.

##### autocompletePrefix

The `autocompletePrefix` option is optional and by default it is set to an empty string. This is a string that will be added at the beginning of all lines generated by autocomplete (e.g. list of available autocompletions).

This option can also be a function returning string and accepting two integer parameters - lineNumber and matchNumber.

If `autocompleteStyle` is set to `list` those two parameters are always the same and represent number of line for which prefix should be returned (0-indexed, counting from the top). They are equal to `-1` for the `Available commands:` line.

If `autocompleteStyle` is set to `multiline`, lineNumber represents number of line for which prefix should be returned (just like if `autocompleteStyle` is set to `list`) and matchNumber represents which match is present in this line (this value changes when the user cycles through autocomplete options). It is also worth noting that the currently selected option is displayed in the same line as the input and no prefix is generated for it.

#### History:

##### context

The context is important for the history. If you program is handling a specific process you want to have an history of the commands available in that specific context. The `context` has to be an increasing integer starting from 0 (which is the default if no context is passed).

Run the example in `examples/autocompletions.js` to see how the options work.

##### historyFilter

It is optional. It has to be a function which returns a string or a null and accepts as a parameter a string representing last command used (after `filter` command has been applied).

This allows you to modify how commands will be saved into history and what will be typed when you use the up and down arrows (which is especially useful if you are dealing with colors in the `filter` command).

If this function returns null given command isn't saved to the memory at all.

## Requirements

Starting with version v0.0.7, inquirer-command-prompt requires Node 6+.

## Credits
Francesco Sullo, [Filmos](http://filmos.net/)

## License
MIT
