# Sass structure

Outlining techniques for structuring and authoring Sass documents in a modular way, which I have found invaluable when working on web application projects both large and small and within frontend development teams.

Borrowing heavily ideas and thinking from the excellent [Scalable and Modular Architecture for CSS](https://smacss.com) guide by [Jonathan Snook](https://snook.ca). If you haven't yet had the chance to read about SMACSS already this should be considered essential reading for anyone whom authors CSS in large, unhealthy amounts.

In addition I have included a [Sass Linter utility](#sass-linter) written in Node.js to validate document naming conventions against the structures outlined below.

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
- [Sass linter](#sass-linter)

## Core aims

- Leverage techniques to write documents with a [DRY](https://en.wikipedia.org/wiki/Don't_repeat_yourself) approach and encourage style reuse wherever possible.
- With everything in Sass being essentially global (such as [variables](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#variables_) and [placeholder selectors](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#placeholder_selectors_)) enforce a strong namespacing convention to avoid clobbering between what should be isolated sections of styling/code.
- Split out style definitions into logical groupings - aiming for lower lines-of-code over multiple files rather than all-in-one monster documents.

## File roles

What follows is each of the Sass file *roles* employed, their purpose and hierarchical location within a project.

### Config

A single config file located at [`[sassroot]/config.scss`](example/config.scss) provides variables for all *global* project values and settings. The file contains **only** variable definitions, nothing else. Think of them as a projects constants.

Examples of configuration items:

- Font families, font sizes, line heights
- Responsive layout breakpoints
- Spacings, margins, padding
- Color definitions

I personally rely on configuration variables whenever possible - not only helps keep consistency across a project (what was the `rgba()` code for the company branded red again?) it helps me refactor and reduce excessive variations of style items (e.g. do we really need those 12 font sizes and 16 shades of blue across the site?).

Naming for variables is always `$camelCased` and avoids any of the variable prefixing used for modules, components and layouts.

### Libraries

Libraries placed in [[sassroot]/lib](example/lib) are units of Sass/CSS code which will typically make their way into every project, nothing really project specific.

For example:

- CSS resets
- Mixins for vendor prefix helpers (e.g. for CSS3 animation/transition, linear gradients, border radius)
- Responsive width media query mixin helpers

For what I would currently place here, check out my [sassboilerplate](https://github.com/magnetikonline/sassboilerplate) repository.

### Modules

A [[sassroot]/module](example/module) closely follows the concepts outlined in [SMACSS](https://smacss.com/book/type-module), being:

- A discrete component of the page - e.g. it could be a site header or footer, product details display, site navigation menu or a photo gallery widget.
- Using **only** classes, never IDs for selectors to encourage repeat use of modules within a page.
- A naming convention for all classes generated by the module prefixed with the basename of the scss file, with all class names fully lowercased.
- Minimise/avoid the use of element selectors.

Examples are good - this being an imaginary `module/pageheader.scss` module:

```scss
$mPageHeader_iconSize: 10px;


%mPageHeader_iconPopout {
	border: 3px solid $colorBrown;
}

function mPageHeader_calcWidth() {

	// pointless example
	@return 60px;
}

@mixin mPageHeader_addWhiteSpaceAndAlign() {
	// again, pointless
	text-align: center;
	white-space: nowrap;
}


// -- header frame --
.pageheader {
	background: $colorBlueHeader;
	border: 1px solid $colorRed;
	padding: $spacingBase;

	> .navigationarea {
		background: $colorOrange;
		height: 20px;
		width: mPageHeader_calcWidth();
	}
}

// -- navigation item --
.pageheader-navigationitem {
	@include mPageHeader_addWhiteSpaceAndAlign();
	font-size: $fontSizeMedium;
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
- Using [child combinator](https://css-tricks.com/child-and-sibling-selectors/) selectors where possible to control targeting of styles. I typically never go deeper than three levels of nesting to keep things flatter and reduce complex CSS rule chains, hence why the styles for `.pageheader-navigationitem` are their own base class name, rather than defined under `.navigationarea`.
- All comments using C style syntax (won't be outputted to generated CSS).
- Base level comments written as `// -- module item name --` - I find the dashes help with visual separation.
- Variables, placeholder selectors, function and mixins that are used solely within this module are named in a consistent form of `$mModuleName_variableName` to avoid clashes with other parts of the project.

### Components

Sass styles that are shared across multiple [modules](#modules) are defined in a [[sassroot]/component](example/component) file, using `@extend` directives combined with [placeholder selectors](http://sass-lang.com/documentation/file.SASS_REFERENCE.html#placeholder_selectors_), which by design encourage reuse without repeating style blocks.

They could be items such as:

- Feature box border/shadow treatments
- Button styles
- Heading treatments
- Blog post body text typography

For example if we now decide that the `.navigationarea` treatment in the `module/pageheader.scss` module has reuse elsewhere in our project (e.g. we decide to have navigation look/feel repeated in the footer) we could create a `component/navigationarea.scss` component file of:

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

...and then update our existing `module/pageheader.scss` module to:

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

.. and finally a new `module/pagefooter.scss` could then `@extend` those same placeholder classes.

Key points:

- As with [modules](#modules) above - variables, placeholder selectors, function and mixins named in a consistent form of `$cComponentName_variableName` / `%cComponentName_placeholderName` / etc.
- A component file *does not* emit CSS, it **only** defines placeholder selectors.

### Layout

The [`[sassroot]/layout.scss`](example/layout.scss) file defines the projects grid - generally things such as column spans in traditional grid systems, main/sidebar area grids and responsive page frames. A layout area is typically a containment for [modules](#modules) and typically does not involve itself with visual elements such as color or typography.

Again loosely based around the SMACSS concept of [layout rules](https://smacss.com/book/type-layout), and will **only** contain placeholder selectors which are then applied to [module](#modules) classes.

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

- Variables, placeholder selectors, function and mixins named in a consistent form of `$lVariableName` / `%lPlaceholderName`.
- As with [components](#components), the `layout.scss` file *does not* emit any CSS of it's own, **only** define placeholder selectors for use within [modules](#modules) and (possibly) components.

### Mixins

Any additional mixins required for the project are defined in [`[sassroot]/mixin.scss`](example/mixin.scss). No real enforcement of naming conventions here and I aim to limit their use - instead trying to use placeholder selectors within [components](#components) whenever possible.

### Style

Finally [`[sassroot]/style.scss`](example/style.scss) brings everything above together via a series of `@import` statements to generate the resulting CSS output - it **will not** define any variables, placeholders, mixins or CSS class definitions of its own.

The order of includes is as follows - somewhat important to support how placeholders and `@extend` work together:

- Config
- Mixins
- CSS reset (the first actual output of CSS)
- Web fonts
	- **Note:** if using `@import` to include in web font, say when using [Google Fonts](https://www.google.com/fonts) this import will be automatically promoted to the first line of CSS output.
- Layout
- Components
- Modules

To simplify the inclusion of component and module files I make use of the [Sass Globbing Plugin](https://github.com/chriseppstein/sass-globbing), which allows for wildcards with `@import` statements. Thus the final `style.scss` can be as simple as:

```scss
// resetbase / font / layout
@import 'lib/resetbase';
@import 'font';
@import 'layout';

// component / module
@import 'component/*';
@import 'module/*';
```

## Example project

View a simple [sample project](example) that puts all the concepts outlined above together.

## Sass linter

To help validate naming conventions and correct use of file roles within the outlined structure I have put together a [Node.js](https://nodejs.org) script (version 6 and up) for the task.

Checks are very basic (simple regular expression style validations) and **does not** validate the Scss itself for syntax/validation errors.

It is run either from your current directory (where `style.scss` resides), or by passing a full path to `style.scss`:

```sh
$ nodejs linter.js /path/to/scss/project/scss/root
```
