#!/usr/bin/env node

import { runCli } from "./run";

process.exit(runCli(process.argv.slice(2)));
