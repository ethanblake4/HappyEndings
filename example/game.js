/**
 * A 2D game framework.
 * Graphics are created using SKIA CanvasKit and 2Dimensions Flare.
 *
 * @author Ethan Elshyeb
 */

class Game {

	/**
	 * Creates a Game
	 * @param canvas {HTMLCanvasElement} The canvas element to draw to
	 * @param sceneRoot {GameObject} The GameObject scene root
	 * @param assetPaths {Array} Flare asset paths
	 * @param fontPaths {Array} Font asset paths
	 */
	constructor(
		/** @type HTMLCanvasElement */ canvas,
		/** @type GameObject **/ sceneRoot,
		/** @type Array */ assetPaths,
		/** @type Array */ fontPaths) {
		this.canvas = canvas;
		this.graphics = new Flare.Graphics(canvas);
		this.sceneRoot = sceneRoot;
		this.sceneRoot.parent = this;
		this.rendering = false;
		this.onFrame = [];
		this.assetPaths = assetPaths;
		this.fontPaths = fontPaths;
		this.fonts = {};
		this.loaded = false;
		this.loadedCount = 0;
		this.loadedFonts = 0;
		this.actors = {};
		this.loadingScene = new ColorClear(0,0,0);
		this.loadingScene.addChild(new TextObject(100, 100, "Loading...", 255,255,255,null, 30));
	}

	/**
	 * Starts the game.
	 * If there are Flare assets to load, this will first load the assets.
	 */
	start() {
		if(!this.rendering) {
			console.log("Starting game...");

			this.graphics.initialize((ck) => {
				this.canvasKit = ck;
				if(!this.loaded && this.assetPaths.length > 0) {
					console.log("Loading assets...");
					this._load();
				} else this.loaded = true;
				this._render();
			});
			this.rendering = true;
			console.log("Game started");
		} else console.warn("Game was already started")
	}

	_load() {
		this.assetPaths.forEach((path) => {
			this._loadActor("./flare/"+path, (cb) => {
				if(cb != null && !cb.error) {
					cb.initialize(this.graphics);
					this.actors[path] = cb;
					console.log("Loaded actor " + path);
					this.loadedCount++;
					if(this.loadedCount === this.assetPaths.length && this.loadedFonts === this.fontPaths.length) {
						console.log("Load complete!");
						this.loaded = true;
					}
				} else {
					console.log("Actor load error: " + path);
					console.log(cb);
				}
			});
		});
		const _this = this;
		this.fontPaths.forEach((url) => {
			let req = new XMLHttpRequest();
			req.open("GET", "./font/"+url, true);
			req.responseType = "blob";
			req.onload = function()
			{
				let fileReader = new FileReader();
				fileReader.onload = function()
				{
					_this.fonts[url] = _this.canvasKit.SkFontMgr.RefDefault().MakeTypefaceFromData(this.result);
					console.log("Loaded font " + url);
					_this.loadedFonts++;
					if(_this.loadedCount === _this.assetPaths.length && _this.loadedFonts === _this.fontPaths.length) {
						console.log("Load complete!");
						_this.loaded = true;
					}
				};
				fileReader.readAsArrayBuffer(this.response);
			};
			req.send();
		});
	}

	/**
	 * Loads a Flare actor from the specified URL
	 * @param url the URL to load the actor from
	 * @param callback Closure (String|Actor?) Actor, error string, or null
	 * @private Accessed through start()
	 */
	_loadActor(/** @type {string} */ url, /** @type {Function} */ callback) {
		new Flare.ActorLoader().load(url, callback);
	}

	/**
	 * Renders a frame and schedules the next frame to be rendered
	 * @private You should not call this method directly. Use start() instead.
	 */
	_render() {
		this.setSize(window.innerWidth, window.innerHeight);
		if(!this.loaded) {
			this.loadingScene.draw(this.graphics, this.canvasKit, 0, 0);
		} else {
			this.sceneRoot.draw(this.graphics, this.canvasKit, 0, 0);
			this.onFrame.forEach((f) => f());
		}
		this.graphics.flush();
		window.requestAnimationFrame(this._render.bind(this));
	}

	/**
	 * Adds a callback to be run on every frame.
	 * @param listener The callback to run on every frame.
	 */
	addFrameListener(/** @type {Function} */ listener) {
		this.onFrame.push(listener)
	}

	/**
	 * Removes a callback added with addFrameListener()
	 * @param listener The callback to remove.
	 */
	removeFrameListener(/** @type {Function} */ listener) {
		this.onFrame = this.onFrame.filter((f) => f !== listener)
	}

	/**
	 * Use for the purpose of the game property of GameObjects
	 * @returns {Game} This game object.
	 */
	get game() { return this; }

	/**
	 * @returns The width in physical pixels of this game
	 */
	get width() { return this.canvas.width; }

	/**
	 * @returns {number} The height in physical pixels of this game
	 */
	get height() { return this.canvas.height; }

	/**
	 * sets the size of the game
	 * @param width Width in logical px
	 * @param height Height in logical px
	 */
	setSize(/** @type {number} */ width, /** @type {number} */ height) {
		this.graphics.setSize(width, height);
	}
}

/**
 * A base GameObject draws its children GameObjects.
 */
class GameObject {

	/**
	 * Creates a GameObject.
	 * @param x The starting x-coordinate.
	 * @param y The starting y-coordinate.
	 * @param children {Array<GameObject>} The list of children.
	 */
	constructor(
		/** @type {number} */ x,
		/** @type {number} */ y,
		/** @type {Array} */ children) {
		this.x = x;
		this.y = y;
		this.children = children.map((child) => {
			child.parent = this; child.attach(); return child;
		});
		this.parent = null;
		this.collider = new Collider();
		this.didInitGfx = false;
	}

	/**
	 * Use for making Scenes.
	 * @returns {GameObject} a GameObject at (0,0) with a default Collider and no children.
	 */
	static newDefault() {
		return new GameObject(0, 0, []);
	}

	/** Fires when this GameObject has been attached to a parent */
	attach() {}

	initGfx(graphics, canvasKit) {}

	/**
	 * Draws this GameObject at an offset of xoff, yoff on ctx.
	 */
	draw(/** @type Flare.Graphics */ graphics, /** @type {CanvasKit} */ canvasKit,
		 /** @type number */ xoff, /** @type {number} */ yoff) {
		if(!this.didInitGfx) {
			this.initGfx(graphics, canvasKit);
			this.didInitGfx = true;
		}
		this.children.forEach((child) => child.draw(graphics, canvasKit, this.x + xoff, this.y + yoff));
	}

	/**
	 * Returns the Game that this object is attached to, if any
	 * @returns {Game}
	 */
	get game() {
		return this.parent.game;
	}

	/**
	 * Only works for objects with a reduced offset of (0, 0)
	 * @returns {boolean} whether this GameObject is outside the viewport.
	 */
	get outsideViewport() {
		return this.x < 0 || this.y < 0 || this.x > this.game.width || this.y > this.game.height;
	}

	/**
	 * Adds a GameObject to this GameObject's list of children
	 * Will reparent and call GameObject.attach() on the child to be added.
	 *
	 * @param child {GameObject} The GameObject to add as a child
	 */
	addChild(/** @type GameObject **/ child) {
		child.parent = this;
		child.attach();
		this.children.push(child);
	}

	/**
	 * Gets one of this GameObject's children
	 * @param where The filter function to execute on each child
	 * @returns {*|GameObject}
	 */
	getChild(/** @type {Function}*/ where) {
		for(let i=0; i < this.children.length; i++) {
			if(where(this.children[i])) return this.children[i];
		}
	}

	/**
	 * Removes child from this GameObject's list of children
	 * This function is relatively slow, use with care.
	 * @param child The GameObject child to remove
	 */
	removeChild(/** @type GameObject **/ child) {
		this.children = this.children.filter((c) => c !== child);
	}

	/**
	 * Removes children from this GameObject based on a filter.
	 * @param filter The filter function to execute on each GameObject.
	 */
	removeChildren(/** @type Function */ filter) {
		this.children = this.children.filter(filter);
	}

	/**
	 * Checks if this GameObject overlaps another GameObject
	 * @param other
	 * @returns {boolean}
	 */
	doesOverlap(/** @type GameObject */ other) {
		return this.collider.checkOverlap(other.collider);
	}

	isInside(/** @type GameObject */ other) {
		return this.collider.checkInside(other.collider);
	}

	doesContain(/** @type GameObject */ other) {
		return other.isInside(this);
	}

	findOverlaps(/** @type GameObject */ other) {
		let found = [];
		if (this.doesOverlap(other)) found.push(this);
		this.children.forEach((child) => {
			if (child.doesOverlap(other)) {
				found.push(child);
			}
		});
		return found;
	}
}

/**
 * Default implementation of Collider that does not collide.
 */
class Collider {

	constructor() {}

	/**
	 * Checks if this Collider overlaps other Collider
	 * @param other The other Collider
	 */
	checkOverlap(/** @type Collider */ other) {
		return false; // Stub
	}

	/**
	 * Checks if this Collider is inside other Collider
	 * @param other The other Collider
	 */
	checkInside(/** @type Collider */ other) {
		return false; // Stub
	}
}

class RectCollider extends Collider {

	constructor(x, y, width, height) {
		super();
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	checkOverlap(/** @type Collider */ other) {
		if (other instanceof RectCollider) {
			return !(this.x > other.x + other.width ||
				this.x + this.width < other.x ||
				this.y > other.y + other.height ||
				this.y + this.height < other.y)
		} else return false;
	}

	checkInside(/** @type Collider */ other) {
		if (other instanceof RectCollider) {
			return (this.x > other.x && this.y > other.y
				&& this.x + this.width < other.x + other.width
				&& this.y + this.height < other.y + other.height);
		} else return false;
	}

}

class FlareObject extends GameObject {

	constructor(x, y, url, scale) {
		super(x, y, []);
		this.url = url;
		this.scale = scale;
		this._viewTransform = mat2d.create();
		const vt = this._viewTransform;
		vt[0] = scale;
		vt[3] = scale;
		vt[4] = this.x;
		vt[5] = this.y;
	}

	initGfx(graphics, canvasKit) {
		super.initGfx(graphics, canvasKit);

		if(this._actor) {
			this._actor.dispose(graphics);
		}
		if(this._actorInstance) {
			this._actorInstance.dispose(graphics);
		}

		this._lastAdvanceTime = Date.now();

		const actor = this.game.actors[this.url];
		const actorInstance = actor.makeInstance();
		actorInstance.initialize(graphics);

		this._actor = actor;
		this._actorInstance = actorInstance;

		if(actorInstance) {
			actorInstance.initialize(graphics);
			if(actorInstance._Animations.length) {
				/** Instantiate the Animation. */
				this._animation = actorInstance._Animations[0];
				this._animationInstance = new Flare.AnimationInstance(this._animation._Actor, this._animation);
				if(!this._animationInstance) console.log("No animation found at " + url);
			}
		}
	}

	draw(graphics, canvasKit, xoff, yoff) {

		super.draw(graphics, canvasKit, xoff, yoff);

		const now = Date.now();
		const elapsed = (now - this._lastAdvanceTime)/1000.0;
		this._lastAdvanceTime = now;

		const actor = this._actorInstance;

		if(this._animationInstance)
		{
			const ai = this._animationInstance;
			/** Compute the new time and apply it */
			ai.time = ai.time + elapsed;
			ai.apply(this._actorInstance, 1.0);
		}

		if(actor)
		{
			const vt = this._viewTransform;

			vt[0] = this.scale;
			vt[3] = this.scale;
			vt[4] = this.x;
			vt[5] = this.y;
			/** Advance the actor to its new time. */
			actor.advance(elapsed);
			graphics.save();
			graphics.setView(this._viewTransform);
			this._actorInstance.draw(graphics);
			graphics.restore();
		}
	}
}

class ColorClear extends GameObject {
	constructor(r, g, b, a = 1.0) {
		super(0, 0, []);
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	draw(graphics, canvasKit, xoff, yoff) {
		graphics.clear([this.r, this.g, this.b, this.a]);
		super.draw(graphics, canvasKit, xoff, yoff);
	}
}

class ColorCover extends GameObject {
	constructor(r, g, b, a = 1.0) {
		super(0, 0, []);
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	initGfx(graphics, canvasKit) {
		this.paint = graphics.makePaint(false);
	}

	draw(graphics, canvasKit, xoff, yoff) {
		super.draw(graphics, canvasKit, xoff, yoff);
		graphics.setPaintColor(this.paint, [this.r, this.g, this.b, this.a]);
		graphics.drawRect(0, 0, this.game.width, this.game.height, this.paint);
		super.draw(graphics, canvasKit, xoff, yoff);
	}
}

class TextObject extends GameObject {

	constructor(x, y, text, r, g, b, font, size, fill = true) {
		super(x, y, []);
		this.text = text;
		this.r = r;
		this.g = g;
		this.b = b;
		this.font = font;
		this.size = size;
		this.fill = fill;
	}

	initGfx(graphics, canvasKit) {
		super.initGfx();
		this.skFont = new canvasKit.SkFont(this.font == null ? null : this.game.fonts[this.font], this.size);
		this.paint = new canvasKit.SkPaint();
		this.paint.setColor(canvasKit.Color(this.r, this.g, this.b, 1.0));
		this.paint.setAntiAlias(true);
	}

	draw(graphics, canvasKit, xoff, yoff) {
		super.draw(graphics, canvasKit, xoff, yoff);
		graphics._SkCanvas.drawText(this.text, this.x + xoff, this.y + yoff, this.paint, this.skFont);
	}
}