#!/usr/bin/env node

const {
  say
} = require('./util');
const yargs = require('yargs');
const process = require('process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const {
  IsBlank
} = require('./tileutil/isblank.js');
const {
  Dump
} = require('./tileutil/dump.js');

const args = yargs
  .strict(true)
  .usage("$0 <command> [args]")
  .command("isblank [files...]", "Output names of specified files which are blank (100% alpha)",
    yargs => {
      yargs.option('verbose', {
        alias: 'v',
        type: 'boolean',
        describe: 'Verbose; dump non-blank image data, etc'
      })
    },
    function(argv) {
      IsBlank(argv);
    })
  .command("dump [file]", "Dump data about file",
    yargs => {},
    function(argv) {
      Dump(argv);
    })
  .option("help", {
    alias: 'h',
    type: 'boolean',
    describe: "Show help"
  })
  .showHelpOnFail(true)
  .argv //
;
