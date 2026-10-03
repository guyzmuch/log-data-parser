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
we can sort the table by column (asc/desc)


## Techno :
next, react, shadcn, playwright tests

## Questions
Isn't it what logstash is actually doing??

## Advanced:
Have the posibility to upload multipe data, and join then via column or by data (i have difficulties to see rhis, but like group result from the second data that contain some info, to the first data. Like if the first data has a column "entity_id", rhen on the second data, if it contains this value, it can be listed under the line. It might help group data from the second data set)
That could be cool if we could connect it to a live logs, like connect it to a terminal output. Maybe thos could be done via a command line, where we forward the output of a terminal via stream into the interface
v1's delimiter split is a plain string split, not quote-aware (a delimiter inside a quoted CSV value, e.g. `a,"b,c",d`, splits wrong). Could swap in a real CSV parser package specifically for uploaded `.csv` files later, while keeping the simple splitter for pasted/raw log text.


## Done
make the interface largeur
Better ui for column selection
Posibility to save multiple view for one profile
when opening a new profile creation wizard the form should be cleared
column should displayed for the top one to the bottom, and we should order the column by drag and drop
only numbers that looks like timpstamps should be parsed as detec
option to trim all the cell (but not by default, because it might be usefull)
All the cell (data and header) should be trimmed by default, but you can choose not to trimmed them via option
we sohuld be able to resize the column of the array, and data will have elipse at the end
when parsing a column in a certain way, add the new column after the "parent" column instead of at the end of the column, and unmark the parent column to hide it (because by default, we would only want the parsed data, not the raw one)
You could also display entry in 2 lines
Posibility to add comment on each data line
user can specify a column that would be color coded based on the data inside. example, the request method if selected, will have the GET highlighted in a color, the POST in another. the color should be deterministic (maybe base on a sha), so that same text will always get the same color (this might be a bit difficult to have enough nice different color).



like in kibana, I should be able to filter in/out by the content of a cell to auto filter by this entry
 

## improvement seen while working

columns selection should make the "shift" button work to unselect multiple column
we should have an "hide all" column and "show all" columns button
we should be able to search/filter column by name to active them or not (like in kibana)
once the data is parsed, we should remove the insertion fields (or maybe hide it in a tab or something)
be able to duplicate a profile (so we start from a base)
be able to sort the profile
since we detect cell, maybe notify column that only have empty data
be able to sort data by column (asc, desc)
maybe make the parsing of field via regex
parse stack trace to multiline info (example error log in kibana)
like in kibana, the historic of the search is saved in local storage for the user, and can be autocomplete
for the autodetected parsing of data, add some specific styling to the button that will do this (like a star or something) so it stand out
Can change the font on some of the column (to have some info bigger)
You could tonsome processing on some cell like: remove any stingified characters (like \" or stuffs), base 64 decode, parse a celle that is json (even if stringified) into sub column. Maybe, a bit like for the date, try to auto detect json, and propose a parsing
we can sort the table by column (asc/desc)
Could we have something simple that learn from previous file name, and if the name of 3 different file are similare, the we proposed the parsing profile that was used most for this type of file name (like format, extension, first line, etc) when i say proposed, I just mean a suggestion of the parsing profile


## to think over
i want "children" column to be nested under the parent but still have a simple way to re-order the column