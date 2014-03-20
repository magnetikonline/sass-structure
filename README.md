# Sass structure
Outlining techniques for structuring and authoring Sass documents in a modular way, which I have found invaluable when working on web application projects both large and small and within frontend development teams.

Borrowing heavily ideas and thinking from the excellent [Scalable and Modular Architecture for CSS](http://smacss.com) guide by [Jonathan Snook](http://snook.ca). If you haven't yet had the chance to read about SMACSS already this should be considered essential reading for anyone whom authors CSS in large, unhealthy amounts.

In addition I have included a [Sass Linter utility](#sass-linter) written in NodeJS to validate Sass document naming conventions against the structures outlined below.

- [Core aims](#core-aims)
- [File roles](#file-roles)
	- [Config](#config)
	- [Libraries](#libraries)
	- [Modules](#modules)
	- [Components](#components)
	- [Layout](#layout)
	- [Mixins](#mixins)
	- [Style](#style)
- [Example project](#example-project)
- [Sass Linter](#sass-linter)

## Core aims
- Leverage Sass techniques to write documents with a [DRY](http://en.wikipedia.org/wiki/Don't_repeat_yourself) approach and encourage reuse wherever feasible.
- With everything in Sass being essentially global (such as [variables](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#variables_) and [placeholder selectors](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#placeholder_selectors_)) enforce a strong namespacing convention to avoid clobbering/clashes between what should be isolated sections of Sass.
- Split out Sass styling definitions into logical groupings - aiming for lower lines-of-code over multiple files rather than all-in-one monster documents.

## File roles
What follows is each of the Sass file *roles* employed, their purpose and hierarchical location within a project.

### Config
A single config file located at [[sassroot]/config.scss](example/config.scss) provides variables for all *global* project values and settings. The file contains **only** variable definitions, nothing else. Think of them a project constants.

Examples of configuration kept here:
- Font families, font sizes, line heights
- Responsive layout breakpoints
- Spacings, margins, padding
- Color definitions

I personally rely on configuration variables for everything possible, it not only works to keep things consistent across a project (what was the hex code for the company branded red again?) it helps me refactor and reduce excessive variations of a style item during development (do we really need 12 font sizes/16 shades of blue across the site?).

Naming for variables is always `$camelCased` and avoids any of the variable prefixing used for modules, components and layouts.

### Libraries
Libraries placed in [[sassroot]/lib](example/lib) are pieces of Sass/CSS code which will typically make their way into every project, nothing really project specific.

For example:
- CSS resets
- Mixins for vendor prefix helpers (e.g. for CSS3 animation/transition, linear gradients, border radius)
- Responsive width media query mixin helpers

For what I would currently place here, check out my [sassboilerplate](https://github.com/magnetikonline/sassboilerplate) repository.

### Modules
A [[sassroot]/module](example/module) closely follows the concepts outlined in [SMACSS](http://smacss.com/book/type-module), being:
- A discrete component of the page - e.g. it could be a site header or footer, product details display, site navigation menu or a photo gallery widget.
- Using **only** classes, never IDs for selectors to encourage repeat use of modules within a page.
- A naming convention for all classes generated from the module prefixed with the basename of the scss file to avoid clashes, with all class names fully lowercased.
- Minimise/avoid the use of element selectors.

Examples are good - this being an imaginary `module/pageheader.scss` module:

```scss
$mPageHeader_iconSize: 10px;


%mPageHeader_iconPopout {
	border: 3px solid $colorBrown;
}

// -- header frame --
.pageheader {
	background: $colorBlueHeader;
	border: 1px solid $colorRed;
	padding: $spacingBase;

	> .navigationarea {
		background: $colorOrange;
		height: 20px;
		width: 60px;
	}
}

// -- navigation item --
.pageheader-navigationitem {
	font-size: $fontSizeMedium;
	text-align: center;
	white-space: nowrap;
	width: 30%;

	// icon treatment
	> .icon {
		@extend %mPageHeader_iconPopout;
		background: $colorGreen;
		height: $mPageHeader_iconSize;
		width: $mPageHeader_iconSize;
	}
}
```

The key things to note here are:
- Heavy use of variables, which would be defined in the projects [config](#config) file.
- All base class names have a prefix matching that of the module/scss filename (`.pageheader` and `.pageheader-navigationitem`), using a single dash for namespacing of sub-classes within the module.
- Using [child combinator](http://css-tricks.com/child-and-sibling-selectors/) selectors where possible to control targeting of styles. I typically never go deeper than three levels of nesting to keep things flatter and reduce complex CSS rule chains, hence why the styles for `.pageheader-navigationitem` are their own base class name rather than defined under `.navigationarea`.
- Comments using C style syntax (won't be outputted to generated CSS). Base level comments are written as `// -- module item name --` since I find the dashes help with visual separation.
- Variables and placeholder selectors that are used solely within this module are named in a consistent format of `$mModuleName_variableName` to avoid clashes with other parts of the Sass project.

### Components
Scss styles that are to be shared across multiple [modules](#modules) are defined in a [[sassroot]/component](example/component), using Sass's `@extend` and [placeholder selectors](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#placeholder_selectors_) which by design encourage reuse without bloating/repeating styling blocks.

They could be your feature box border/shadow treatments, button styles, heading treatments, blog post body text typography, etc.

For example if we now decide that the `.navigationarea` treatment in our `module/pageheader.scss` module above has some reuse elsewhere in our project (e.g. we now want navigation repeated in the footer) we then create a `component/navigationarea.scss` file:

```scss
$cNavigationArea_width: 60px;


// -- default --
%cNavigationArea {
	background: $colorOrange;
	height: 20px;
	width: $cNavigationArea_width;
}

// -- make it 'pop' --
%cNavigationArea_makeItPop {
	font-size: $fontSizeMega;
	font-weight: bold;
	width: ($cNavigationArea_width * 5);
}
```

...and then update `module/pageheader.scss` to:

```scss
// -- header frame --
.pageheader {
	background: $colorBlueHeader;
	border: 1px solid $colorRed;
	padding: $spacingBase;

	> .navigationarea {
		@extend %cNavigationArea;

		// ...or to make it 'pop'
		&.pop {
			@extend %cNavigationArea_makeItPop;
		}
	}
}
```

Key points:
- Variables and placeholder selectors are named in a consistent format of `$cComponentName_variableName` / `%cComponentName_placeholderName`.
- A component file should not emit any CSS of it's own, it **only** defines placeholder selectors.

### Layout
The [[sassroot]/layout.scss](example/layout.scss) file defines the projects grid - generally things such as column spans in traditional grid systems, main/sidebar area grids and responsive page frames. A layout area is typically a containment for [modules](#modules) and typically does not involve itself with visual elements such as color or typography.

Again loosely based around the SMACSS concept of [layout rules](http://smacss.com/book/type-layout), and will **only** contain placeholder selectors which are then applied to [module](#modules) classes.

An example `layout.scss` defining the responsive width breakpoints for a *page frame* using my [sassboilerplate respondwidth.scss](https://github.com/magnetikonline/sassboilerplate/blob/master/respondwidth.scss) mixins.

```scss
$lAnotherVariableForLayoutUseOnly: 20em;


// -- responsive width page frame --
%lPageFrame {
	margin: 0 auto;
	width: $pageWidthMax;

	@include respondWidthFromUpTo($respondWidthMicro,$respondWidthCenti) {
		width: $pageWidthCenti;
	}

	@include respondWidthFromUpTo($respondWidthNano,$respondWidthMicro) {
		width: $pageWidthMicro;
	}

	@include respondWidthUpTo($respondWidthNano) {
		width: $pageWidthNano;
	}
}
```

...applied to a `.pageheader` module like so:

```scss
.pageheader {
	@extend %lPageFrame;
	background: $colorBlueHeader;
	border: 1px solid $colorRed;
	padding: $spacingBase;
}
```

Key points:
- Variables and placeholder selectors are named in a consistent format of `$lVariableName` / `%lPlaceholderName`.
- The `layout.scss` file should not emit any CSS of it's own, **only** define placeholder selectors for use on [modules](#modules).

### Mixins
Any additional mixins required for the project are defined in [[sassroot]/mixin.scss](example/mixin.scss). No real enforcement of naming conventions here and I aim to limit their use - instead trying to use placeholder selectors within [components](#components) whenever possible.

### Style
Finally, the [[sassroot]/style.scss](example/style.scss) file brings everything above together via `@import` statements and will generate the resulting CSS output document. Style itself **will not** define any variables, placeholders, mixins or CSS class definitions.

The order of includes is the following and is somewhat important to support how Sass placeholders and `@extend` work together:
- Config
- Mixins
- CSS reset (the first actual output of CSS)
- Layout
- Components
- Modules

## Example project
View a simple [sample project](example) that puts all the concepts outlined above together.

## Sass Linter
To help validate naming conventions and the correct use of Sass file roles in the outlined structure I have put together a [NodeJS](http://nodejs.org) script for the task.

Checks are very basic (simple regular expression style validations) and **does not** validate the Scss itself for syntax/validation errors.

It is run either from your current directory (where `style.scss` resides), or by passing a full path to `style.scss`:

```
nodejs linter.js /path/to/scss/project/scss/root
```
