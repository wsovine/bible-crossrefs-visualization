# Overall Idea / Brainstorming
I would like to create a first draft of a scrollytelling webpage. The basic premise behind the visualizations is what was created in notebooks/02_exploration/03_arc_visualization.ipynb

I want to take users through a visual journey that draws the arcs from old testament to new and new testament to old.

I would love the scroll to be like a timeline (so maybe we need years added into the Graph DB?). As the user scrolls starting with Genesis, the visual could draw the arcs to the new testament. Along the way, any dense arcs landing in certain new testament themes could be highlighted with the verses or themes that are found in that endpoint.

## Potential Useful Libraries
scrollama - https://github.com/russellsamora/scrollama

## Additions needed for graph database
As the storyboard/plan is created, we may come across some additional data that is needed. Document that here and I will work to bring that data in as a parallel fork to this scrollytelling project.

# Story
1. Intro - review my decisions in the main project README, give a background for the project and why I'm using the data sources that I am.
2. Old Testament Scroll - draw arcs from old to new testament while moving through the books and years
3. New Testament Scroll - draw arcs from the new to old testament while moving through the books and years
4. Key Councils and Dates - when we get to certain dates, like when the bible was officially canonized, we can maybe glow up all the 73 books that were canonized. Maybe also dates around when the bible was translated into major languages.
5. Protestant Reformation - when we get to the protestant reformation, we will do a sad dark dropout of the 7 books that protestants lose out on

# Key implementation approach
This project will be a lot of trial and error and recursive refining. Let's pause often to test small additions and updates.