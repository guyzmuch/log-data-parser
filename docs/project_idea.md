## ideas thrown out
Parsing of log and data
Can save, import and export settings
This is purelly on the page (no back end)
A bit like in kibana you can search fields and add/remove then, and save this as a profile for next time
You could also display entry in 2 lines
You can hide some line (select could be done via ctrl or shift)
You can search on the column (csn either highlight valies, or only display line matching)
You can upload a file, or just copy paste
Can parse CSV and auto detect separatir, or propose it
You can have some pre- profile for common parsing
Can configure some profile to have easy acces to them
Could it detect if fisrt and last entries are only parcial and disregard them??
Can export the formated data
Can change the font on some of the column (to have some info bigger
Should auto detect tumestamp and date and propose "extra" column of formated date (to user timezone or iso or both)
Should remove the quote around data if any.
Posibility to add comment on each data line
You could tonsome processing on some cell like: remove any stingified characters (like \" or stuffs), base 64 decode, parse a celle that is json (even if stringified) into sub column. Maybe, a bit like for the date, try to auto detect json, and propose a parsing
We should have an interactive parsing configuration, like when libreoffice parse a csv
On peut troer me tableau en colonne


## Techno :
next, react, shadcn, playwright tests

## Questions
Isn't it what logstash is actually doing??

## Advanced:
Have the posibility to upload multipe data, and join then via column or by data (i have difficulties to see rhis, but like group result from the second data that contain some info, to the first data. Like if the first data has a column "entity_id", rhen on the second data, if it contains this value, it can be listed under the line. It might help group data from the second data set)
That could be cool if we could connect it to a live logs, like connect it to a terminal output. Maybe thos could be done via a command line, where we forward the output of a terminal via stream into the interface
v1's delimiter split is a plain string split, not quote-aware (a delimiter inside a quoted CSV value, e.g. `a,"b,c",d`, splits wrong). Could swap in a real CSV parser package specifically for uploaded `.csv` files later, while keeping the simple splitter for pasted/raw log text.

since we detect cell, maybe notify column that only have empty data