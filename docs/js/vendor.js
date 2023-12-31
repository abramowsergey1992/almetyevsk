/*!
 * Stickyfill – `position: sticky` polyfill
 * v. 2.1.0 | https://github.com/wilddeer/stickyfill
 * MIT License
 */

(function (window, document) {
	"use strict";

	/*
	 * 1. Check if the browser supports `position: sticky` natively or is too old to run the polyfill.
	 *    If either of these is the case set `seppuku` flag. It will be checked later to disable key features
	 *    of the polyfill, but the API will remain functional to avoid breaking things.
	 */

	var _createClass = (function () {
		function defineProperties(target, props) {
			for (var i = 0; i < props.length; i++) {
				var descriptor = props[i];
				descriptor.enumerable = descriptor.enumerable || false;
				descriptor.configurable = true;
				if ("value" in descriptor) descriptor.writable = true;
				Object.defineProperty(target, descriptor.key, descriptor);
			}
		}
		return function (Constructor, protoProps, staticProps) {
			if (protoProps) defineProperties(Constructor.prototype, protoProps);
			if (staticProps) defineProperties(Constructor, staticProps);
			return Constructor;
		};
	})();

	function _classCallCheck(instance, Constructor) {
		if (!(instance instanceof Constructor)) {
			throw new TypeError("Cannot call a class as a function");
		}
	}

	var seppuku = false;

	var isWindowDefined = typeof window !== "undefined";

	// The polyfill can’t function properly without `window` or `window.getComputedStyle`.
	if (!isWindowDefined || !window.getComputedStyle) seppuku = true;
	// Dont’t get in a way if the browser supports `position: sticky` natively.
	else {
		(function () {
			var testNode = document.createElement("div");

			if (
				["", "-webkit-", "-moz-", "-ms-"].some(function (prefix) {
					try {
						testNode.style.position = prefix + "sticky";
					} catch (e) {}

					return testNode.style.position != "";
				})
			)
				seppuku = true;
		})();
	}

	/*
	 * 2. “Global” vars used across the polyfill
	 */
	var isInitialized = false;

	// Check if Shadow Root constructor exists to make further checks simpler
	var shadowRootExists = typeof ShadowRoot !== "undefined";

	// Last saved scroll position
	var scroll = {
		top: null,
		left: null,
	};

	// Array of created Sticky instances
	var stickies = [];

	/*
	 * 3. Utility functions
	 */
	function extend(targetObj, sourceObject) {
		for (var key in sourceObject) {
			if (sourceObject.hasOwnProperty(key)) {
				targetObj[key] = sourceObject[key];
			}
		}
	}

	function parseNumeric(val) {
		return parseFloat(val) || 0;
	}

	function getDocOffsetTop(node) {
		var docOffsetTop = 0;

		while (node) {
			docOffsetTop += node.offsetTop;
			node = node.offsetParent;
		}

		return docOffsetTop;
	}

	/*
	 * 4. Sticky class
	 */

	var Sticky = (function () {
		function Sticky(node) {
			_classCallCheck(this, Sticky);

			if (!(node instanceof HTMLElement))
				throw new Error("First argument must be HTMLElement");
			if (
				stickies.some(function (sticky) {
					return sticky._node === node;
				})
			)
				throw new Error("Stickyfill is already applied to this node");

			this._node = node;
			this._stickyMode = null;
			this._active = false;

			stickies.push(this);

			this.refresh();
		}

		_createClass(Sticky, [
			{
				key: "refresh",
				value: function refresh() {
					if (seppuku || this._removed) return;
					if (this._active) this._deactivate();

					var node = this._node;

					/*
					 * 1. Save node computed props
					 */
					var nodeComputedStyle = getComputedStyle(node);
					var nodeComputedProps = {
						position: nodeComputedStyle.position,
						top: nodeComputedStyle.top,
						display: nodeComputedStyle.display,
						marginTop: nodeComputedStyle.marginTop,
						marginBottom: nodeComputedStyle.marginBottom,
						marginLeft: nodeComputedStyle.marginLeft,
						marginRight: nodeComputedStyle.marginRight,
						cssFloat: nodeComputedStyle.cssFloat,
					};

					/*
					 * 2. Check if the node can be activated
					 */
					if (
						isNaN(parseFloat(nodeComputedProps.top)) ||
						nodeComputedProps.display == "table-cell" ||
						nodeComputedProps.display == "none"
					)
						return;

					this._active = true;

					/*
					 * 3. Check if the current node position is `sticky`. If it is, it means that the browser supports sticky positioning,
					 *    but the polyfill was force-enabled. We set the node’s position to `static` before continuing, so that the node
					 *    is in it’s initial position when we gather its params.
					 */
					var originalPosition = node.style.position;
					if (
						nodeComputedStyle.position == "sticky" ||
						nodeComputedStyle.position == "-webkit-sticky"
					)
						node.style.position = "static";

					/*
					 * 4. Get necessary node parameters
					 */
					var referenceNode = node.parentNode;
					var parentNode =
						shadowRootExists && referenceNode instanceof ShadowRoot
							? referenceNode.host
							: referenceNode;
					var nodeWinOffset = node.getBoundingClientRect();
					var parentWinOffset = parentNode.getBoundingClientRect();
					var parentComputedStyle = getComputedStyle(parentNode);

					this._parent = {
						node: parentNode,
						styles: {
							position: parentNode.style.position,
						},
						offsetHeight: parentNode.offsetHeight,
					};
					this._offsetToWindow = {
						left: nodeWinOffset.left,
						right:
							document.documentElement.clientWidth -
							nodeWinOffset.right,
					};
					this._offsetToParent = {
						top:
							nodeWinOffset.top -
							parentWinOffset.top -
							parseNumeric(parentComputedStyle.borderTopWidth),
						left:
							nodeWinOffset.left -
							parentWinOffset.left -
							parseNumeric(parentComputedStyle.borderLeftWidth),
						right:
							-nodeWinOffset.right +
							parentWinOffset.right -
							parseNumeric(parentComputedStyle.borderRightWidth),
					};
					this._styles = {
						position: originalPosition,
						top: node.style.top,
						bottom: node.style.bottom,
						left: node.style.left,
						right: node.style.right,
						width: node.style.width,
						marginTop: node.style.marginTop,
						marginLeft: node.style.marginLeft,
						marginRight: node.style.marginRight,
					};

					var nodeTopValue = parseNumeric(nodeComputedProps.top);
					this._limits = {
						start:
							nodeWinOffset.top +
							window.pageYOffset -
							nodeTopValue,
						end:
							parentWinOffset.top +
							window.pageYOffset +
							parentNode.offsetHeight -
							parseNumeric(
								parentComputedStyle.borderBottomWidth
							) -
							node.offsetHeight -
							nodeTopValue -
							parseNumeric(nodeComputedProps.marginBottom),
					};

					/*
					 * 5. Ensure that the node will be positioned relatively to the parent node
					 */
					var parentPosition = parentComputedStyle.position;

					if (
						parentPosition != "absolute" &&
						parentPosition != "relative"
					) {
						parentNode.style.position = "relative";
					}

					/*
					 * 6. Recalc node position.
					 *    It’s important to do this before clone injection to avoid scrolling bug in Chrome.
					 */
					this._recalcPosition();

					/*
					 * 7. Create a clone
					 */
					var clone = (this._clone = {});
					clone.node = document.createElement("div");

					// Apply styles to the clone
					extend(clone.node.style, {
						width: nodeWinOffset.right - nodeWinOffset.left + "px",
						height: nodeWinOffset.bottom - nodeWinOffset.top + "px",
						marginTop: nodeComputedProps.marginTop,
						marginBottom: nodeComputedProps.marginBottom,
						marginLeft: nodeComputedProps.marginLeft,
						marginRight: nodeComputedProps.marginRight,
						cssFloat: nodeComputedProps.cssFloat,
						padding: 0,
						border: 0,
						borderSpacing: 0,
						fontSize: "1em",
						position: "static",
					});

					referenceNode.insertBefore(clone.node, node);
					clone.docOffsetTop = getDocOffsetTop(clone.node);
				},
			},
			{
				key: "_recalcPosition",
				value: function _recalcPosition() {
					if (!this._active || this._removed) return;

					var stickyMode =
						scroll.top <= this._limits.start
							? "start"
							: scroll.top >= this._limits.end
							? "end"
							: "middle";

					if (this._stickyMode == stickyMode) return;

					switch (stickyMode) {
						case "start":
							extend(this._node.style, {
								position: "absolute",
								left: this._offsetToParent.left + "px",
								right: this._offsetToParent.right + "px",
								top: this._offsetToParent.top + "px",
								bottom: "auto",
								width: "auto",
								marginLeft: 0,
								marginRight: 0,
								marginTop: 0,
							});
							break;

						case "middle":
							extend(this._node.style, {
								position: "fixed",
								left: this._offsetToWindow.left + "px",
								right: this._offsetToWindow.right + "px",
								top: this._styles.top,
								bottom: "auto",
								width: "auto",
								marginLeft: 0,
								marginRight: 0,
								marginTop: 0,
							});
							break;

						case "end":
							extend(this._node.style, {
								position: "absolute",
								left: this._offsetToParent.left + "px",
								right: this._offsetToParent.right + "px",
								top: "auto",
								bottom: 0,
								width: "auto",
								marginLeft: 0,
								marginRight: 0,
							});
							break;
					}

					this._stickyMode = stickyMode;
				},
			},
			{
				key: "_fastCheck",
				value: function _fastCheck() {
					if (!this._active || this._removed) return;

					if (
						Math.abs(
							getDocOffsetTop(this._clone.node) -
								this._clone.docOffsetTop
						) > 1 ||
						Math.abs(
							this._parent.node.offsetHeight -
								this._parent.offsetHeight
						) > 1
					)
						this.refresh();
				},
			},
			{
				key: "_deactivate",
				value: function _deactivate() {
					var _this = this;

					if (!this._active || this._removed) return;

					this._clone.node.parentNode.removeChild(this._clone.node);
					delete this._clone;

					extend(this._node.style, this._styles);
					delete this._styles;

					// Check whether element’s parent node is used by other stickies.
					// If not, restore parent node’s styles.
					if (
						!stickies.some(function (sticky) {
							return (
								sticky !== _this &&
								sticky._parent &&
								sticky._parent.node === _this._parent.node
							);
						})
					) {
						extend(this._parent.node.style, this._parent.styles);
					}
					delete this._parent;

					this._stickyMode = null;
					this._active = false;

					delete this._offsetToWindow;
					delete this._offsetToParent;
					delete this._limits;
				},
			},
			{
				key: "remove",
				value: function remove() {
					var _this2 = this;

					this._deactivate();

					stickies.some(function (sticky, index) {
						if (sticky._node === _this2._node) {
							stickies.splice(index, 1);
							return true;
						}
					});

					this._removed = true;
				},
			},
		]);

		return Sticky;
	})();

	/*
	 * 5. Stickyfill API
	 */

	var Stickyfill = {
		stickies: stickies,
		Sticky: Sticky,

		forceSticky: function forceSticky() {
			seppuku = false;
			init();

			this.refreshAll();
		},
		addOne: function addOne(node) {
			// Check whether it’s a node
			if (!(node instanceof HTMLElement)) {
				// Maybe it’s a node list of some sort?
				// Take first node from the list then
				if (node.length && node[0]) node = node[0];
				else return;
			}

			// Check if Stickyfill is already applied to the node
			// and return existing sticky
			for (var i = 0; i < stickies.length; i++) {
				if (stickies[i]._node === node) return stickies[i];
			}

			// Create and return new sticky
			return new Sticky(node);
		},
		add: function add(nodeList) {
			// If it’s a node make an array of one node
			if (nodeList instanceof HTMLElement) nodeList = [nodeList];
			// Check if the argument is an iterable of some sort
			if (!nodeList.length) return;

			// Add every element as a sticky and return an array of created Sticky instances
			var addedStickies = [];

			var _loop = function _loop(i) {
				var node = nodeList[i];

				// If it’s not an HTMLElement – create an empty element to preserve 1-to-1
				// correlation with input list
				if (!(node instanceof HTMLElement)) {
					addedStickies.push(void 0);
					return "continue";
				}

				// If Stickyfill is already applied to the node
				// add existing sticky
				if (
					stickies.some(function (sticky) {
						if (sticky._node === node) {
							addedStickies.push(sticky);
							return true;
						}
					})
				)
					return "continue";

				// Create and add new sticky
				addedStickies.push(new Sticky(node));
			};

			for (var i = 0; i < nodeList.length; i++) {
				var _ret2 = _loop(i);

				if (_ret2 === "continue") continue;
			}

			return addedStickies;
		},
		refreshAll: function refreshAll() {
			stickies.forEach(function (sticky) {
				return sticky.refresh();
			});
		},
		removeOne: function removeOne(node) {
			// Check whether it’s a node
			if (!(node instanceof HTMLElement)) {
				// Maybe it’s a node list of some sort?
				// Take first node from the list then
				if (node.length && node[0]) node = node[0];
				else return;
			}

			// Remove the stickies bound to the nodes in the list
			stickies.some(function (sticky) {
				if (sticky._node === node) {
					sticky.remove();
					return true;
				}
			});
		},
		remove: function remove(nodeList) {
			// If it’s a node make an array of one node
			if (nodeList instanceof HTMLElement) nodeList = [nodeList];
			// Check if the argument is an iterable of some sort
			if (!nodeList.length) return;

			// Remove the stickies bound to the nodes in the list

			var _loop2 = function _loop2(i) {
				var node = nodeList[i];

				stickies.some(function (sticky) {
					if (sticky._node === node) {
						sticky.remove();
						return true;
					}
				});
			};

			for (var i = 0; i < nodeList.length; i++) {
				_loop2(i);
			}
		},
		removeAll: function removeAll() {
			while (stickies.length) {
				stickies[0].remove();
			}
		},
	};

	/*
	 * 6. Setup events (unless the polyfill was disabled)
	 */
	function init() {
		if (isInitialized) {
			return;
		}

		isInitialized = true;

		// Watch for scroll position changes and trigger recalc/refresh if needed
		function checkScroll() {
			if (window.pageXOffset != scroll.left) {
				scroll.top = window.pageYOffset;
				scroll.left = window.pageXOffset;

				Stickyfill.refreshAll();
			} else if (window.pageYOffset != scroll.top) {
				scroll.top = window.pageYOffset;
				scroll.left = window.pageXOffset;

				// recalc position for all stickies
				stickies.forEach(function (sticky) {
					return sticky._recalcPosition();
				});
			}
		}

		checkScroll();
		window.addEventListener("scroll", checkScroll);

		// Watch for window resizes and device orientation changes and trigger refresh
		window.addEventListener("resize", Stickyfill.refreshAll);
		window.addEventListener("orientationchange", Stickyfill.refreshAll);

		//Fast dirty check for layout changes every 500ms
		var fastCheckTimer = void 0;

		function startFastCheckTimer() {
			fastCheckTimer = setInterval(function () {
				stickies.forEach(function (sticky) {
					return sticky._fastCheck();
				});
			}, 500);
		}

		function stopFastCheckTimer() {
			clearInterval(fastCheckTimer);
		}

		var docHiddenKey = void 0;
		var visibilityChangeEventName = void 0;

		if ("hidden" in document) {
			docHiddenKey = "hidden";
			visibilityChangeEventName = "visibilitychange";
		} else if ("webkitHidden" in document) {
			docHiddenKey = "webkitHidden";
			visibilityChangeEventName = "webkitvisibilitychange";
		}

		if (visibilityChangeEventName) {
			if (!document[docHiddenKey]) startFastCheckTimer();

			document.addEventListener(visibilityChangeEventName, function () {
				if (document[docHiddenKey]) {
					stopFastCheckTimer();
				} else {
					startFastCheckTimer();
				}
			});
		} else startFastCheckTimer();
	}

	if (!seppuku) init();

	/*
	 * 7. Expose Stickyfill
	 */
	if (typeof module != "undefined" && module.exports) {
		module.exports = Stickyfill;
	} else if (isWindowDefined) {
		window.Stickyfill = Stickyfill;
	}
})(window, document);

!(function (e, t) {
	"object" == typeof exports && "undefined" != typeof module
		? (module.exports = t())
		: "function" == typeof define && define.amd
		? define(t)
		: (e.AOS = t());
})(this, function () {
	"use strict";
	var e =
			"undefined" != typeof window
				? window
				: "undefined" != typeof global
				? global
				: "undefined" != typeof self
				? self
				: {},
		t = "Expected a function",
		n = NaN,
		o = "[object Symbol]",
		i = /^\s+|\s+$/g,
		a = /^[-+]0x[0-9a-f]+$/i,
		r = /^0b[01]+$/i,
		c = /^0o[0-7]+$/i,
		s = parseInt,
		u = "object" == typeof e && e && e.Object === Object && e,
		d = "object" == typeof self && self && self.Object === Object && self,
		l = u || d || Function("return this")(),
		f = Object.prototype.toString,
		m = Math.max,
		p = Math.min,
		b = function () {
			return l.Date.now();
		};
	function v(e, n, o) {
		var i,
			a,
			r,
			c,
			s,
			u,
			d = 0,
			l = !1,
			f = !1,
			v = !0;
		if ("function" != typeof e) throw new TypeError(t);
		function y(t) {
			var n = i,
				o = a;
			return (i = a = void 0), (d = t), (c = e.apply(o, n));
		}
		function h(e) {
			var t = e - u;
			return void 0 === u || t >= n || t < 0 || (f && e - d >= r);
		}
		function k() {
			var e = b();
			if (h(e)) return x(e);
			s = setTimeout(
				k,
				(function (e) {
					var t = n - (e - u);
					return f ? p(t, r - (e - d)) : t;
				})(e)
			);
		}
		function x(e) {
			return (s = void 0), v && i ? y(e) : ((i = a = void 0), c);
		}
		function O() {
			var e = b(),
				t = h(e);
			if (((i = arguments), (a = this), (u = e), t)) {
				if (void 0 === s)
					return (function (e) {
						return (d = e), (s = setTimeout(k, n)), l ? y(e) : c;
					})(u);
				if (f) return (s = setTimeout(k, n)), y(u);
			}
			return void 0 === s && (s = setTimeout(k, n)), c;
		}
		return (
			(n = w(n) || 0),
			g(o) &&
				((l = !!o.leading),
				(r = (f = "maxWait" in o) ? m(w(o.maxWait) || 0, n) : r),
				(v = "trailing" in o ? !!o.trailing : v)),
			(O.cancel = function () {
				void 0 !== s && clearTimeout(s),
					(d = 0),
					(i = u = a = s = void 0);
			}),
			(O.flush = function () {
				return void 0 === s ? c : x(b());
			}),
			O
		);
	}
	function g(e) {
		var t = typeof e;
		return !!e && ("object" == t || "function" == t);
	}
	function w(e) {
		if ("number" == typeof e) return e;
		if (
			(function (e) {
				return (
					"symbol" == typeof e ||
					((function (e) {
						return !!e && "object" == typeof e;
					})(e) &&
						f.call(e) == o)
				);
			})(e)
		)
			return n;
		if (g(e)) {
			var t = "function" == typeof e.valueOf ? e.valueOf() : e;
			e = g(t) ? t + "" : t;
		}
		if ("string" != typeof e) return 0 === e ? e : +e;
		e = e.replace(i, "");
		var u = r.test(e);
		return u || c.test(e) ? s(e.slice(2), u ? 2 : 8) : a.test(e) ? n : +e;
	}
	var y = function (e, n, o) {
			var i = !0,
				a = !0;
			if ("function" != typeof e) throw new TypeError(t);
			return (
				g(o) &&
					((i = "leading" in o ? !!o.leading : i),
					(a = "trailing" in o ? !!o.trailing : a)),
				v(e, n, { leading: i, maxWait: n, trailing: a })
			);
		},
		h = "Expected a function",
		k = NaN,
		x = "[object Symbol]",
		O = /^\s+|\s+$/g,
		j = /^[-+]0x[0-9a-f]+$/i,
		E = /^0b[01]+$/i,
		N = /^0o[0-7]+$/i,
		z = parseInt,
		C = "object" == typeof e && e && e.Object === Object && e,
		A = "object" == typeof self && self && self.Object === Object && self,
		q = C || A || Function("return this")(),
		L = Object.prototype.toString,
		T = Math.max,
		M = Math.min,
		S = function () {
			return q.Date.now();
		};
	function D(e) {
		var t = typeof e;
		return !!e && ("object" == t || "function" == t);
	}
	function H(e) {
		if ("number" == typeof e) return e;
		if (
			(function (e) {
				return (
					"symbol" == typeof e ||
					((function (e) {
						return !!e && "object" == typeof e;
					})(e) &&
						L.call(e) == x)
				);
			})(e)
		)
			return k;
		if (D(e)) {
			var t = "function" == typeof e.valueOf ? e.valueOf() : e;
			e = D(t) ? t + "" : t;
		}
		if ("string" != typeof e) return 0 === e ? e : +e;
		e = e.replace(O, "");
		var n = E.test(e);
		return n || N.test(e) ? z(e.slice(2), n ? 2 : 8) : j.test(e) ? k : +e;
	}
	var $ = function (e, t, n) {
			var o,
				i,
				a,
				r,
				c,
				s,
				u = 0,
				d = !1,
				l = !1,
				f = !0;
			if ("function" != typeof e) throw new TypeError(h);
			function m(t) {
				var n = o,
					a = i;
				return (o = i = void 0), (u = t), (r = e.apply(a, n));
			}
			function p(e) {
				var n = e - s;
				return void 0 === s || n >= t || n < 0 || (l && e - u >= a);
			}
			function b() {
				var e = S();
				if (p(e)) return v(e);
				c = setTimeout(
					b,
					(function (e) {
						var n = t - (e - s);
						return l ? M(n, a - (e - u)) : n;
					})(e)
				);
			}
			function v(e) {
				return (c = void 0), f && o ? m(e) : ((o = i = void 0), r);
			}
			function g() {
				var e = S(),
					n = p(e);
				if (((o = arguments), (i = this), (s = e), n)) {
					if (void 0 === c)
						return (function (e) {
							return (
								(u = e), (c = setTimeout(b, t)), d ? m(e) : r
							);
						})(s);
					if (l) return (c = setTimeout(b, t)), m(s);
				}
				return void 0 === c && (c = setTimeout(b, t)), r;
			}
			return (
				(t = H(t) || 0),
				D(n) &&
					((d = !!n.leading),
					(a = (l = "maxWait" in n) ? T(H(n.maxWait) || 0, t) : a),
					(f = "trailing" in n ? !!n.trailing : f)),
				(g.cancel = function () {
					void 0 !== c && clearTimeout(c),
						(u = 0),
						(o = s = i = c = void 0);
				}),
				(g.flush = function () {
					return void 0 === c ? r : v(S());
				}),
				g
			);
		},
		W = function () {};
	function P(e) {
		e &&
			e.forEach(function (e) {
				var t = Array.prototype.slice.call(e.addedNodes),
					n = Array.prototype.slice.call(e.removedNodes);
				if (
					(function e(t) {
						var n = void 0,
							o = void 0;
						for (n = 0; n < t.length; n += 1) {
							if ((o = t[n]).dataset && o.dataset.aos) return !0;
							if (o.children && e(o.children)) return !0;
						}
						return !1;
					})(t.concat(n))
				)
					return W();
			});
	}
	function Y() {
		return (
			window.MutationObserver ||
			window.WebKitMutationObserver ||
			window.MozMutationObserver
		);
	}
	var _ = {
			isSupported: function () {
				return !!Y();
			},
			ready: function (e, t) {
				var n = window.document,
					o = new (Y())(P);
				(W = t),
					o.observe(n.documentElement, {
						childList: !0,
						subtree: !0,
						removedNodes: !0,
					});
			},
		},
		B = function (e, t) {
			if (!(e instanceof t))
				throw new TypeError("Cannot call a class as a function");
		},
		F = (function () {
			function e(e, t) {
				for (var n = 0; n < t.length; n++) {
					var o = t[n];
					(o.enumerable = o.enumerable || !1),
						(o.configurable = !0),
						"value" in o && (o.writable = !0),
						Object.defineProperty(e, o.key, o);
				}
			}
			return function (t, n, o) {
				return n && e(t.prototype, n), o && e(t, o), t;
			};
		})(),
		I =
			Object.assign ||
			function (e) {
				for (var t = 1; t < arguments.length; t++) {
					var n = arguments[t];
					for (var o in n)
						Object.prototype.hasOwnProperty.call(n, o) &&
							(e[o] = n[o]);
				}
				return e;
			},
		K =
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i,
		G =
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,
		J =
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i,
		Q =
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;
	function R() {
		return navigator.userAgent || navigator.vendor || window.opera || "";
	}
	var U = new ((function () {
			function e() {
				B(this, e);
			}
			return (
				F(e, [
					{
						key: "phone",
						value: function () {
							var e = R();
							return !(!K.test(e) && !G.test(e.substr(0, 4)));
						},
					},
					{
						key: "mobile",
						value: function () {
							var e = R();
							return !(!J.test(e) && !Q.test(e.substr(0, 4)));
						},
					},
					{
						key: "tablet",
						value: function () {
							return this.mobile() && !this.phone();
						},
					},
					{
						key: "ie11",
						value: function () {
							return (
								"-ms-scroll-limit" in
									document.documentElement.style &&
								"-ms-ime-align" in
									document.documentElement.style
							);
						},
					},
				]),
				e
			);
		})())(),
		V = function (e, t) {
			var n = void 0;
			return (
				U.ie11()
					? (n = document.createEvent("CustomEvent")).initCustomEvent(
							e,
							!0,
							!0,
							{ detail: t }
					  )
					: (n = new CustomEvent(e, { detail: t })),
				document.dispatchEvent(n)
			);
		},
		X = function (e) {
			return e.forEach(function (e, t) {
				return (function (e, t) {
					var n = e.options,
						o = e.position,
						i = e.node,
						a =
							(e.data,
							function () {
								e.animated &&
									((function (e, t) {
										t &&
											t.forEach(function (t) {
												return e.classList.remove(t);
											});
									})(i, n.animatedClassNames),
									V("aos:out", i),
									e.options.id &&
										V("aos:in:" + e.options.id, i),
									(e.animated = !1));
							});
					n.mirror && t >= o.out && !n.once
						? a()
						: t >= o.in
						? e.animated ||
						  ((function (e, t) {
								t &&
									t.forEach(function (t) {
										return e.classList.add(t);
									});
						  })(i, n.animatedClassNames),
						  V("aos:in", i),
						  e.options.id && V("aos:in:" + e.options.id, i),
						  (e.animated = !0))
						: e.animated && !n.once && a();
				})(e, window.pageYOffset);
			});
		},
		Z = function (e) {
			for (
				var t = 0, n = 0;
				e && !isNaN(e.offsetLeft) && !isNaN(e.offsetTop);

			)
				(t += e.offsetLeft - ("BODY" != e.tagName ? e.scrollLeft : 0)),
					(n +=
						e.offsetTop - ("BODY" != e.tagName ? e.scrollTop : 0)),
					(e = e.offsetParent);
			return { top: n, left: t };
		},
		ee = function (e, t, n) {
			var o = e.getAttribute("data-aos-" + t);
			if (void 0 !== o) {
				if ("true" === o) return !0;
				if ("false" === o) return !1;
			}
			return o || n;
		},
		te = function (e, t) {
			return (
				e.forEach(function (e, n) {
					var o = ee(e.node, "mirror", t.mirror),
						i = ee(e.node, "once", t.once),
						a = ee(e.node, "id"),
						r = t.useClassNames && e.node.getAttribute("data-aos"),
						c = [t.animatedClassName]
							.concat(r ? r.split(" ") : [])
							.filter(function (e) {
								return "string" == typeof e;
							});
					t.initClassName && e.node.classList.add(t.initClassName),
						(e.position = {
							in: (function (e, t, n) {
								var o = window.innerHeight,
									i = ee(e, "anchor"),
									a = ee(e, "anchor-placement"),
									r = Number(ee(e, "offset", a ? 0 : t)),
									c = a || n,
									s = e;
								i &&
									document.querySelectorAll(i) &&
									(s = document.querySelectorAll(i)[0]);
								var u = Z(s).top - o;
								switch (c) {
									case "top-bottom":
										break;
									case "center-bottom":
										u += s.offsetHeight / 2;
										break;
									case "bottom-bottom":
										u += s.offsetHeight;
										break;
									case "top-center":
										u += o / 2;
										break;
									case "center-center":
										u += o / 2 + s.offsetHeight / 2;
										break;
									case "bottom-center":
										u += o / 2 + s.offsetHeight;
										break;
									case "top-top":
										u += o;
										break;
									case "bottom-top":
										u += o + s.offsetHeight;
										break;
									case "center-top":
										u += o + s.offsetHeight / 2;
								}
								return u + r;
							})(e.node, t.offset, t.anchorPlacement),
							out:
								o &&
								(function (e, t) {
									window.innerHeight;
									var n = ee(e, "anchor"),
										o = ee(e, "offset", t),
										i = e;
									return (
										n &&
											document.querySelectorAll(n) &&
											(i =
												document.querySelectorAll(
													n
												)[0]),
										Z(i).top + i.offsetHeight - o
									);
								})(e.node, t.offset),
						}),
						(e.options = {
							once: i,
							mirror: o,
							animatedClassNames: c,
							id: a,
						});
				}),
				e
			);
		},
		ne = function () {
			var e = document.querySelectorAll("[data-aos]");
			return Array.prototype.map.call(e, function (e) {
				return { node: e };
			});
		},
		oe = [],
		ie = !1,
		ae = {
			offset: 120,
			delay: 0,
			easing: "ease",
			duration: 400,
			disable: !1,
			once: !1,
			mirror: !1,
			anchorPlacement: "top-bottom",
			startEvent: "DOMContentLoaded",
			animatedClassName: "aos-animate",
			initClassName: "aos-init",
			useClassNames: !1,
			disableMutationObserver: !1,
			throttleDelay: 99,
			debounceDelay: 50,
		},
		re = function () {
			return document.all && !window.atob;
		},
		ce = function () {
			arguments.length > 0 &&
				void 0 !== arguments[0] &&
				arguments[0] &&
				(ie = !0),
				ie &&
					((oe = te(oe, ae)),
					X(oe),
					window.addEventListener(
						"scroll",
						y(function () {
							X(oe, ae.once);
						}, ae.throttleDelay)
					));
		},
		se = function () {
			if (((oe = ne()), de(ae.disable) || re())) return ue();
			ce();
		},
		ue = function () {
			oe.forEach(function (e, t) {
				e.node.removeAttribute("data-aos"),
					e.node.removeAttribute("data-aos-easing"),
					e.node.removeAttribute("data-aos-duration"),
					e.node.removeAttribute("data-aos-delay"),
					ae.initClassName &&
						e.node.classList.remove(ae.initClassName),
					ae.animatedClassName &&
						e.node.classList.remove(ae.animatedClassName);
			});
		},
		de = function (e) {
			return (
				!0 === e ||
				("mobile" === e && U.mobile()) ||
				("phone" === e && U.phone()) ||
				("tablet" === e && U.tablet()) ||
				("function" == typeof e && !0 === e())
			);
		};
	return {
		init: function (e) {
			return (
				(ae = I(ae, e)),
				(oe = ne()),
				ae.disableMutationObserver ||
					_.isSupported() ||
					(console.info(
						'\n      aos: MutationObserver is not supported on this browser,\n      code mutations observing has been disabled.\n      You may have to call "refreshHard()" by yourself.\n    '
					),
					(ae.disableMutationObserver = !0)),
				ae.disableMutationObserver || _.ready("[data-aos]", se),
				de(ae.disable) || re()
					? ue()
					: (document
							.querySelector("body")
							.setAttribute("data-aos-easing", ae.easing),
					  document
							.querySelector("body")
							.setAttribute("data-aos-duration", ae.duration),
					  document
							.querySelector("body")
							.setAttribute("data-aos-delay", ae.delay),
					  -1 === ["DOMContentLoaded", "load"].indexOf(ae.startEvent)
							? document.addEventListener(
									ae.startEvent,
									function () {
										ce(!0);
									}
							  )
							: window.addEventListener("load", function () {
									ce(!0);
							  }),
					  "DOMContentLoaded" === ae.startEvent &&
							["complete", "interactive"].indexOf(
								document.readyState
							) > -1 &&
							ce(!0),
					  window.addEventListener(
							"resize",
							$(ce, ae.debounceDelay, !0)
					  ),
					  window.addEventListener(
							"orientationchange",
							$(ce, ae.debounceDelay, !0)
					  ),
					  oe)
			);
		},
		refresh: ce,
		refreshHard: se,
	};
});

(function (global, factory) {
	typeof exports === "object" && typeof module !== "undefined"
		? factory(exports)
		: typeof define === "function" && define.amd
		? define(["exports"], factory)
		: ((global = global || self),
		  factory((global.window = global.window || {})));
})(this, function (exports) {
	"use strict";

	var _svgPathExp = /[achlmqstvz]|(-?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,
		_numbersExp = /(?:(-)?\d*\.?\d*(?:e[\-+]?\d+)?)[0-9]/gi,
		_scientific = /[\+\-]?\d*\.?\d+e[\+\-]?\d+/gi,
		_selectorExp = /(^[#\.][a-z]|[a-y][a-z])/i,
		_DEG2RAD = Math.PI / 180,
		_sin = Math.sin,
		_cos = Math.cos,
		_abs = Math.abs,
		_sqrt = Math.sqrt,
		_isString = function _isString(value) {
			return typeof value === "string";
		},
		_isNumber = function _isNumber(value) {
			return typeof value === "number";
		},
		_roundingNum = 1e5,
		_round = function _round(value) {
			return Math.round(value * _roundingNum) / _roundingNum || 0;
		};

	function getRawPath(value) {
		value =
			_isString(value) && _selectorExp.test(value)
				? document.querySelector(value) || value
				: value;
		var e = value.getAttribute ? value : 0,
			rawPath;

		if (e && (value = value.getAttribute("d"))) {
			if (!e._gsPath) {
				e._gsPath = {};
			}

			rawPath = e._gsPath[value];
			return rawPath && !rawPath._dirty
				? rawPath
				: (e._gsPath[value] = stringToRawPath(value));
		}

		return !value
			? console.warn(
					"Expecting a <path> element or an SVG path data string"
			  )
			: _isString(value)
			? stringToRawPath(value)
			: _isNumber(value[0])
			? [value]
			: value;
	}
	function reverseSegment(segment) {
		var i = 0,
			y;
		segment.reverse();

		for (; i < segment.length; i += 2) {
			y = segment[i];
			segment[i] = segment[i + 1];
			segment[i + 1] = y;
		}

		segment.reversed = !segment.reversed;
	}

	var _createPath = function _createPath(e, ignore) {
			var path = document.createElementNS(
					"http://www.w3.org/2000/svg",
					"path"
				),
				attr = [].slice.call(e.attributes),
				i = attr.length,
				name;
			ignore = "," + ignore + ",";

			while (--i > -1) {
				name = attr[i].nodeName.toLowerCase();

				if (ignore.indexOf("," + name + ",") < 0) {
					path.setAttributeNS(null, name, attr[i].nodeValue);
				}
			}

			return path;
		},
		_typeAttrs = {
			rect: "rx,ry,x,y,width,height",
			circle: "r,cx,cy",
			ellipse: "rx,ry,cx,cy",
			line: "x1,x2,y1,y2",
		},
		_attrToObj = function _attrToObj(e, attrs) {
			var props = attrs ? attrs.split(",") : [],
				obj = {},
				i = props.length;

			while (--i > -1) {
				obj[props[i]] = +e.getAttribute(props[i]) || 0;
			}

			return obj;
		};

	function convertToPath(element, swap) {
		var type = element.tagName.toLowerCase(),
			circ = 0.552284749831,
			data,
			x,
			y,
			r,
			ry,
			path,
			rcirc,
			rycirc,
			points,
			w,
			h,
			x2,
			x3,
			x4,
			x5,
			x6,
			y2,
			y3,
			y4,
			y5,
			y6,
			attr;

		if (type === "path" || !element.getBBox) {
			return element;
		}

		path = _createPath(
			element,
			"x,y,width,height,cx,cy,rx,ry,r,x1,x2,y1,y2,points"
		);
		attr = _attrToObj(element, _typeAttrs[type]);

		if (type === "rect") {
			r = attr.rx;
			ry = attr.ry || r;
			x = attr.x;
			y = attr.y;
			w = attr.width - r * 2;
			h = attr.height - ry * 2;

			if (r || ry) {
				x2 = x + r * (1 - circ);
				x3 = x + r;
				x4 = x3 + w;
				x5 = x4 + r * circ;
				x6 = x4 + r;
				y2 = y + ry * (1 - circ);
				y3 = y + ry;
				y4 = y3 + h;
				y5 = y4 + ry * circ;
				y6 = y4 + ry;
				data =
					"M" +
					x6 +
					"," +
					y3 +
					" V" +
					y4 +
					" C" +
					[
						x6,
						y5,
						x5,
						y6,
						x4,
						y6,
						x4 - (x4 - x3) / 3,
						y6,
						x3 + (x4 - x3) / 3,
						y6,
						x3,
						y6,
						x2,
						y6,
						x,
						y5,
						x,
						y4,
						x,
						y4 - (y4 - y3) / 3,
						x,
						y3 + (y4 - y3) / 3,
						x,
						y3,
						x,
						y2,
						x2,
						y,
						x3,
						y,
						x3 + (x4 - x3) / 3,
						y,
						x4 - (x4 - x3) / 3,
						y,
						x4,
						y,
						x5,
						y,
						x6,
						y2,
						x6,
						y3,
					].join(",") +
					"z";
			} else {
				data =
					"M" +
					(x + w) +
					"," +
					y +
					" v" +
					h +
					" h" +
					-w +
					" v" +
					-h +
					" h" +
					w +
					"z";
			}
		} else if (type === "circle" || type === "ellipse") {
			if (type === "circle") {
				r = ry = attr.r;
				rycirc = r * circ;
			} else {
				r = attr.rx;
				ry = attr.ry;
				rycirc = ry * circ;
			}

			x = attr.cx;
			y = attr.cy;
			rcirc = r * circ;
			data =
				"M" +
				(x + r) +
				"," +
				y +
				" C" +
				[
					x + r,
					y + rycirc,
					x + rcirc,
					y + ry,
					x,
					y + ry,
					x - rcirc,
					y + ry,
					x - r,
					y + rycirc,
					x - r,
					y,
					x - r,
					y - rycirc,
					x - rcirc,
					y - ry,
					x,
					y - ry,
					x + rcirc,
					y - ry,
					x + r,
					y - rycirc,
					x + r,
					y,
				].join(",") +
				"z";
		} else if (type === "line") {
			data =
				"M" + attr.x1 + "," + attr.y1 + " L" + attr.x2 + "," + attr.y2;
		} else if (type === "polyline" || type === "polygon") {
			points =
				(element.getAttribute("points") + "").match(_numbersExp) || [];
			x = points.shift();
			y = points.shift();
			data = "M" + x + "," + y + " L" + points.join(",");

			if (type === "polygon") {
				data += "," + x + "," + y + "z";
			}
		}

		path.setAttribute(
			"d",
			rawPathToString((path._gsRawPath = stringToRawPath(data)))
		);

		if (swap && element.parentNode) {
			element.parentNode.insertBefore(path, element);
			element.parentNode.removeChild(element);
		}

		return path;
	}

	function arcToSegment(
		lastX,
		lastY,
		rx,
		ry,
		angle,
		largeArcFlag,
		sweepFlag,
		x,
		y
	) {
		if (lastX === x && lastY === y) {
			return;
		}

		rx = _abs(rx);
		ry = _abs(ry);

		var angleRad = (angle % 360) * _DEG2RAD,
			cosAngle = _cos(angleRad),
			sinAngle = _sin(angleRad),
			PI = Math.PI,
			TWOPI = PI * 2,
			dx2 = (lastX - x) / 2,
			dy2 = (lastY - y) / 2,
			x1 = cosAngle * dx2 + sinAngle * dy2,
			y1 = -sinAngle * dx2 + cosAngle * dy2,
			x1_sq = x1 * x1,
			y1_sq = y1 * y1,
			radiiCheck = x1_sq / (rx * rx) + y1_sq / (ry * ry);

		if (radiiCheck > 1) {
			rx = _sqrt(radiiCheck) * rx;
			ry = _sqrt(radiiCheck) * ry;
		}

		var rx_sq = rx * rx,
			ry_sq = ry * ry,
			sq =
				(rx_sq * ry_sq - rx_sq * y1_sq - ry_sq * x1_sq) /
				(rx_sq * y1_sq + ry_sq * x1_sq);

		if (sq < 0) {
			sq = 0;
		}

		var coef = (largeArcFlag === sweepFlag ? -1 : 1) * _sqrt(sq),
			cx1 = coef * ((rx * y1) / ry),
			cy1 = coef * -((ry * x1) / rx),
			sx2 = (lastX + x) / 2,
			sy2 = (lastY + y) / 2,
			cx = sx2 + (cosAngle * cx1 - sinAngle * cy1),
			cy = sy2 + (sinAngle * cx1 + cosAngle * cy1),
			ux = (x1 - cx1) / rx,
			uy = (y1 - cy1) / ry,
			vx = (-x1 - cx1) / rx,
			vy = (-y1 - cy1) / ry,
			temp = ux * ux + uy * uy,
			angleStart = (uy < 0 ? -1 : 1) * Math.acos(ux / _sqrt(temp)),
			angleExtent =
				(ux * vy - uy * vx < 0 ? -1 : 1) *
				Math.acos(
					(ux * vx + uy * vy) / _sqrt(temp * (vx * vx + vy * vy))
				);

		isNaN(angleExtent) && (angleExtent = PI);

		if (!sweepFlag && angleExtent > 0) {
			angleExtent -= TWOPI;
		} else if (sweepFlag && angleExtent < 0) {
			angleExtent += TWOPI;
		}

		angleStart %= TWOPI;
		angleExtent %= TWOPI;

		var segments = Math.ceil(_abs(angleExtent) / (TWOPI / 4)),
			rawPath = [],
			angleIncrement = angleExtent / segments,
			controlLength =
				((4 / 3) * _sin(angleIncrement / 2)) /
				(1 + _cos(angleIncrement / 2)),
			ma = cosAngle * rx,
			mb = sinAngle * rx,
			mc = sinAngle * -ry,
			md = cosAngle * ry,
			i;

		for (i = 0; i < segments; i++) {
			angle = angleStart + i * angleIncrement;
			x1 = _cos(angle);
			y1 = _sin(angle);
			ux = _cos((angle += angleIncrement));
			uy = _sin(angle);
			rawPath.push(
				x1 - controlLength * y1,
				y1 + controlLength * x1,
				ux + controlLength * uy,
				uy - controlLength * ux,
				ux,
				uy
			);
		}

		for (i = 0; i < rawPath.length; i += 2) {
			x1 = rawPath[i];
			y1 = rawPath[i + 1];
			rawPath[i] = x1 * ma + y1 * mc + cx;
			rawPath[i + 1] = x1 * mb + y1 * md + cy;
		}

		rawPath[i - 2] = x;
		rawPath[i - 1] = y;
		return rawPath;
	}

	function stringToRawPath(d) {
		var a =
				(d + "")
					.replace(_scientific, function (m) {
						var n = +m;
						return n < 0.0001 && n > -0.0001 ? 0 : n;
					})
					.match(_svgPathExp) || [],
			path = [],
			relativeX = 0,
			relativeY = 0,
			twoThirds = 2 / 3,
			elements = a.length,
			points = 0,
			errorMessage = "ERROR: malformed path: " + d,
			i,
			j,
			x,
			y,
			command,
			isRelative,
			segment,
			startX,
			startY,
			difX,
			difY,
			beziers,
			prevCommand,
			flag1,
			flag2,
			line = function line(sx, sy, ex, ey) {
				difX = (ex - sx) / 3;
				difY = (ey - sy) / 3;
				segment.push(
					sx + difX,
					sy + difY,
					ex - difX,
					ey - difY,
					ex,
					ey
				);
			};

		if (!d || !isNaN(a[0]) || isNaN(a[1])) {
			console.log(errorMessage);
			return path;
		}

		for (i = 0; i < elements; i++) {
			prevCommand = command;

			if (isNaN(a[i])) {
				command = a[i].toUpperCase();
				isRelative = command !== a[i];
			} else {
				i--;
			}

			x = +a[i + 1];
			y = +a[i + 2];

			if (isRelative) {
				x += relativeX;
				y += relativeY;
			}

			if (!i) {
				startX = x;
				startY = y;
			}

			if (command === "M") {
				if (segment) {
					if (segment.length < 8) {
						path.length -= 1;
					} else {
						points += segment.length;
					}
				}

				relativeX = startX = x;
				relativeY = startY = y;
				segment = [x, y];
				path.push(segment);
				i += 2;
				command = "L";
			} else if (command === "C") {
				if (!segment) {
					segment = [0, 0];
				}

				if (!isRelative) {
					relativeX = relativeY = 0;
				}

				segment.push(
					x,
					y,
					relativeX + a[i + 3] * 1,
					relativeY + a[i + 4] * 1,
					(relativeX += a[i + 5] * 1),
					(relativeY += a[i + 6] * 1)
				);
				i += 6;
			} else if (command === "S") {
				difX = relativeX;
				difY = relativeY;

				if (prevCommand === "C" || prevCommand === "S") {
					difX += relativeX - segment[segment.length - 4];
					difY += relativeY - segment[segment.length - 3];
				}

				if (!isRelative) {
					relativeX = relativeY = 0;
				}

				segment.push(
					difX,
					difY,
					x,
					y,
					(relativeX += a[i + 3] * 1),
					(relativeY += a[i + 4] * 1)
				);
				i += 4;
			} else if (command === "Q") {
				difX = relativeX + (x - relativeX) * twoThirds;
				difY = relativeY + (y - relativeY) * twoThirds;

				if (!isRelative) {
					relativeX = relativeY = 0;
				}

				relativeX += a[i + 3] * 1;
				relativeY += a[i + 4] * 1;
				segment.push(
					difX,
					difY,
					relativeX + (x - relativeX) * twoThirds,
					relativeY + (y - relativeY) * twoThirds,
					relativeX,
					relativeY
				);
				i += 4;
			} else if (command === "T") {
				difX = relativeX - segment[segment.length - 4];
				difY = relativeY - segment[segment.length - 3];
				segment.push(
					relativeX + difX,
					relativeY + difY,
					x + (relativeX + difX * 1.5 - x) * twoThirds,
					y + (relativeY + difY * 1.5 - y) * twoThirds,
					(relativeX = x),
					(relativeY = y)
				);
				i += 2;
			} else if (command === "H") {
				line(relativeX, relativeY, (relativeX = x), relativeY);
				i += 1;
			} else if (command === "V") {
				line(
					relativeX,
					relativeY,
					relativeX,
					(relativeY = x + (isRelative ? relativeY - relativeX : 0))
				);
				i += 1;
			} else if (command === "L" || command === "Z") {
				if (command === "Z") {
					x = startX;
					y = startY;
					segment.closed = true;
				}

				if (
					command === "L" ||
					_abs(relativeX - x) > 0.5 ||
					_abs(relativeY - y) > 0.5
				) {
					line(relativeX, relativeY, x, y);

					if (command === "L") {
						i += 2;
					}
				}

				relativeX = x;
				relativeY = y;
			} else if (command === "A") {
				flag1 = a[i + 4];
				flag2 = a[i + 5];
				difX = a[i + 6];
				difY = a[i + 7];
				j = 7;

				if (flag1.length > 1) {
					if (flag1.length < 3) {
						difY = difX;
						difX = flag2;
						j--;
					} else {
						difY = flag2;
						difX = flag1.substr(2);
						j -= 2;
					}

					flag2 = flag1.charAt(1);
					flag1 = flag1.charAt(0);
				}

				beziers = arcToSegment(
					relativeX,
					relativeY,
					+a[i + 1],
					+a[i + 2],
					+a[i + 3],
					+flag1,
					+flag2,
					(isRelative ? relativeX : 0) + difX * 1,
					(isRelative ? relativeY : 0) + difY * 1
				);
				i += j;

				if (beziers) {
					for (j = 0; j < beziers.length; j++) {
						segment.push(beziers[j]);
					}
				}

				relativeX = segment[segment.length - 2];
				relativeY = segment[segment.length - 1];
			} else {
				console.log(errorMessage);
			}
		}

		i = segment.length;

		if (i < 6) {
			path.pop();
			i = 0;
		} else if (
			segment[0] === segment[i - 2] &&
			segment[1] === segment[i - 1]
		) {
			segment.closed = true;
		}

		path.totalPoints = points + i;
		return path;
	}
	function rawPathToString(rawPath) {
		if (_isNumber(rawPath[0])) {
			rawPath = [rawPath];
		}

		var result = "",
			l = rawPath.length,
			sl,
			s,
			i,
			segment;

		for (s = 0; s < l; s++) {
			segment = rawPath[s];
			result +=
				"M" + _round(segment[0]) + "," + _round(segment[1]) + " C";
			sl = segment.length;

			for (i = 2; i < sl; i++) {
				result +=
					_round(segment[i++]) +
					"," +
					_round(segment[i++]) +
					" " +
					_round(segment[i++]) +
					"," +
					_round(segment[i++]) +
					" " +
					_round(segment[i++]) +
					"," +
					_round(segment[i]) +
					" ";
			}

			if (segment.closed) {
				result += "z";
			}
		}

		return result;
	}

	/*!
	 * MorphSVGPlugin 3.10.4
	 * https://greensock.com
	 *
	 * @license Copyright 2008-2022, GreenSock. All rights reserved.
	 * Subject to the terms at https://greensock.com/standard-license or for
	 * Club GreenSock members, the agreement issued with that membership.
	 * @author: Jack Doyle, jack@greensock.com
	 */

	var gsap,
		_toArray,
		_lastLinkedAnchor,
		_coreInitted,
		PluginClass,
		_getGSAP = function _getGSAP() {
			return (
				gsap ||
				(typeof window !== "undefined" &&
					(gsap = window.gsap) &&
					gsap.registerPlugin &&
					gsap)
			);
		},
		_isFunction = function _isFunction(value) {
			return typeof value === "function";
		},
		_atan2 = Math.atan2,
		_cos$1 = Math.cos,
		_sin$1 = Math.sin,
		_sqrt$1 = Math.sqrt,
		_PI = Math.PI,
		_2PI = _PI * 2,
		_angleMin = _PI * 0.3,
		_angleMax = _PI * 0.7,
		_bigNum = 1e20,
		_numExp = /[-+=\.]*\d+[\.e\-\+]*\d*[e\-\+]*\d*/gi,
		_selectorExp$1 = /(^[#\.][a-z]|[a-y][a-z])/i,
		_commands = /[achlmqstvz]/i,
		_log = function _log(message) {
			return console && console.warn(message);
		},
		_bonusValidated = 1,
		_getAverageXY = function _getAverageXY(segment) {
			var l = segment.length,
				x = 0,
				y = 0,
				i;

			for (i = 0; i < l; i++) {
				x += segment[i++];
				y += segment[i];
			}

			return [x / (l / 2), y / (l / 2)];
		},
		_getSize = function _getSize(segment) {
			var l = segment.length,
				xMax = segment[0],
				xMin = xMax,
				yMax = segment[1],
				yMin = yMax,
				x,
				y,
				i;

			for (i = 6; i < l; i += 6) {
				x = segment[i];
				y = segment[i + 1];

				if (x > xMax) {
					xMax = x;
				} else if (x < xMin) {
					xMin = x;
				}

				if (y > yMax) {
					yMax = y;
				} else if (y < yMin) {
					yMin = y;
				}
			}

			segment.centerX = (xMax + xMin) / 2;
			segment.centerY = (yMax + yMin) / 2;
			return (segment.size = (xMax - xMin) * (yMax - yMin));
		},
		_getTotalSize = function _getTotalSize(rawPath, samplesPerBezier) {
			if (samplesPerBezier === void 0) {
				samplesPerBezier = 3;
			}

			var j = rawPath.length,
				xMax = rawPath[0][0],
				xMin = xMax,
				yMax = rawPath[0][1],
				yMin = yMax,
				inc = 1 / samplesPerBezier,
				l,
				x,
				y,
				i,
				segment,
				k,
				t,
				inv,
				x1,
				y1,
				x2,
				x3,
				x4,
				y2,
				y3,
				y4;

			while (--j > -1) {
				segment = rawPath[j];
				l = segment.length;

				for (i = 6; i < l; i += 6) {
					x1 = segment[i];
					y1 = segment[i + 1];
					x2 = segment[i + 2] - x1;
					y2 = segment[i + 3] - y1;
					x3 = segment[i + 4] - x1;
					y3 = segment[i + 5] - y1;
					x4 = segment[i + 6] - x1;
					y4 = segment[i + 7] - y1;
					k = samplesPerBezier;

					while (--k > -1) {
						t = inc * k;
						inv = 1 - t;
						x =
							(t * t * x4 + 3 * inv * (t * x3 + inv * x2)) * t +
							x1;
						y =
							(t * t * y4 + 3 * inv * (t * y3 + inv * y2)) * t +
							y1;

						if (x > xMax) {
							xMax = x;
						} else if (x < xMin) {
							xMin = x;
						}

						if (y > yMax) {
							yMax = y;
						} else if (y < yMin) {
							yMin = y;
						}
					}
				}
			}

			rawPath.centerX = (xMax + xMin) / 2;
			rawPath.centerY = (yMax + yMin) / 2;
			rawPath.left = xMin;
			rawPath.width = xMax - xMin;
			rawPath.top = yMin;
			rawPath.height = yMax - yMin;
			return (rawPath.size = (xMax - xMin) * (yMax - yMin));
		},
		_sortByComplexity = function _sortByComplexity(a, b) {
			return b.length - a.length;
		},
		_sortBySize = function _sortBySize(a, b) {
			var sizeA = a.size || _getSize(a),
				sizeB = b.size || _getSize(b);

			return Math.abs(sizeB - sizeA) < (sizeA + sizeB) / 20
				? b.centerX - a.centerX || b.centerY - a.centerY
				: sizeB - sizeA;
		},
		_offsetSegment = function _offsetSegment(segment, shapeIndex) {
			var a = segment.slice(0),
				l = segment.length,
				wrap = l - 2,
				i,
				index;
			shapeIndex = shapeIndex | 0;

			for (i = 0; i < l; i++) {
				index = (i + shapeIndex) % wrap;
				segment[i++] = a[index];
				segment[i] = a[index + 1];
			}
		},
		_getTotalMovement = function _getTotalMovement(
			sb,
			eb,
			shapeIndex,
			offsetX,
			offsetY
		) {
			var l = sb.length,
				d = 0,
				wrap = l - 2,
				index,
				i,
				x,
				y;
			shapeIndex *= 6;

			for (i = 0; i < l; i += 6) {
				index = (i + shapeIndex) % wrap;
				y = sb[index] - (eb[i] - offsetX);
				x = sb[index + 1] - (eb[i + 1] - offsetY);
				d += _sqrt$1(x * x + y * y);
			}

			return d;
		},
		_getClosestShapeIndex = function _getClosestShapeIndex(
			sb,
			eb,
			checkReverse
		) {
			var l = sb.length,
				sCenter = _getAverageXY(sb),
				eCenter = _getAverageXY(eb),
				offsetX = eCenter[0] - sCenter[0],
				offsetY = eCenter[1] - sCenter[1],
				min = _getTotalMovement(sb, eb, 0, offsetX, offsetY),
				minIndex = 0,
				copy,
				d,
				i;

			for (i = 6; i < l; i += 6) {
				d = _getTotalMovement(sb, eb, i / 6, offsetX, offsetY);

				if (d < min) {
					min = d;
					minIndex = i;
				}
			}

			if (checkReverse) {
				copy = sb.slice(0);
				reverseSegment(copy);

				for (i = 6; i < l; i += 6) {
					d = _getTotalMovement(copy, eb, i / 6, offsetX, offsetY);

					if (d < min) {
						min = d;
						minIndex = -i;
					}
				}
			}

			return minIndex / 6;
		},
		_getClosestAnchor = function _getClosestAnchor(rawPath, x, y) {
			var j = rawPath.length,
				closestDistance = _bigNum,
				closestX = 0,
				closestY = 0,
				segment,
				dx,
				dy,
				d,
				i,
				l;

			while (--j > -1) {
				segment = rawPath[j];
				l = segment.length;

				for (i = 0; i < l; i += 6) {
					dx = segment[i] - x;
					dy = segment[i + 1] - y;
					d = _sqrt$1(dx * dx + dy * dy);

					if (d < closestDistance) {
						closestDistance = d;
						closestX = segment[i];
						closestY = segment[i + 1];
					}
				}
			}

			return [closestX, closestY];
		},
		_getClosestSegment = function _getClosestSegment(
			bezier,
			pool,
			startIndex,
			sortRatio,
			offsetX,
			offsetY
		) {
			var l = pool.length,
				index = 0,
				minSize =
					Math.min(
						bezier.size || _getSize(bezier),
						pool[startIndex].size || _getSize(pool[startIndex])
					) * sortRatio,
				min = _bigNum,
				cx = bezier.centerX + offsetX,
				cy = bezier.centerY + offsetY,
				size,
				i,
				dx,
				dy,
				d;

			for (i = startIndex; i < l; i++) {
				size = pool[i].size || _getSize(pool[i]);

				if (size < minSize) {
					break;
				}

				dx = pool[i].centerX - cx;
				dy = pool[i].centerY - cy;
				d = _sqrt$1(dx * dx + dy * dy);

				if (d < min) {
					index = i;
					min = d;
				}
			}

			d = pool[index];
			pool.splice(index, 1);
			return d;
		},
		_subdivideSegmentQty = function _subdivideSegmentQty(
			segment,
			quantity
		) {
			var tally = 0,
				max = 0.999999,
				l = segment.length,
				newPointsPerSegment = quantity / ((l - 2) / 6),
				ax,
				ay,
				cp1x,
				cp1y,
				cp2x,
				cp2y,
				bx,
				by,
				x1,
				y1,
				x2,
				y2,
				i,
				t;

			for (i = 2; i < l; i += 6) {
				tally += newPointsPerSegment;

				while (tally > max) {
					ax = segment[i - 2];
					ay = segment[i - 1];
					cp1x = segment[i];
					cp1y = segment[i + 1];
					cp2x = segment[i + 2];
					cp2y = segment[i + 3];
					bx = segment[i + 4];
					by = segment[i + 5];
					t = 1 / ((Math.floor(tally) || 1) + 1);
					x1 = ax + (cp1x - ax) * t;
					x2 = cp1x + (cp2x - cp1x) * t;
					x1 += (x2 - x1) * t;
					x2 += (cp2x + (bx - cp2x) * t - x2) * t;
					y1 = ay + (cp1y - ay) * t;
					y2 = cp1y + (cp2y - cp1y) * t;
					y1 += (y2 - y1) * t;
					y2 += (cp2y + (by - cp2y) * t - y2) * t;
					segment.splice(
						i,
						4,
						ax + (cp1x - ax) * t,
						ay + (cp1y - ay) * t,
						x1,
						y1,
						x1 + (x2 - x1) * t,
						y1 + (y2 - y1) * t,
						x2,
						y2,
						cp2x + (bx - cp2x) * t,
						cp2y + (by - cp2y) * t
					);
					i += 6;
					l += 6;
					tally--;
				}
			}

			return segment;
		},
		_equalizeSegmentQuantity = function _equalizeSegmentQuantity(
			start,
			end,
			shapeIndex,
			map,
			fillSafe
		) {
			var dif = end.length - start.length,
				longer = dif > 0 ? end : start,
				shorter = dif > 0 ? start : end,
				added = 0,
				sortMethod =
					map === "complexity" ? _sortByComplexity : _sortBySize,
				sortRatio =
					map === "position"
						? 0
						: typeof map === "number"
						? map
						: 0.8,
				i = shorter.length,
				shapeIndices =
					typeof shapeIndex === "object" && shapeIndex.push
						? shapeIndex.slice(0)
						: [shapeIndex],
				reverse = shapeIndices[0] === "reverse" || shapeIndices[0] < 0,
				log = shapeIndex === "log",
				eb,
				sb,
				b,
				x,
				y,
				offsetX,
				offsetY;

			if (!shorter[0]) {
				return;
			}

			if (longer.length > 1) {
				start.sort(sortMethod);
				end.sort(sortMethod);
				offsetX = longer.size || _getTotalSize(longer);
				offsetX = shorter.size || _getTotalSize(shorter);
				offsetX = longer.centerX - shorter.centerX;
				offsetY = longer.centerY - shorter.centerY;

				if (sortMethod === _sortBySize) {
					for (i = 0; i < shorter.length; i++) {
						longer.splice(
							i,
							0,
							_getClosestSegment(
								shorter[i],
								longer,
								i,
								sortRatio,
								offsetX,
								offsetY
							)
						);
					}
				}
			}

			if (dif) {
				if (dif < 0) {
					dif = -dif;
				}

				if (longer[0].length > shorter[0].length) {
					_subdivideSegmentQty(
						shorter[0],
						((longer[0].length - shorter[0].length) / 6) | 0
					);
				}

				i = shorter.length;

				while (added < dif) {
					x = longer[i].size || _getSize(longer[i]);
					b = _getClosestAnchor(
						shorter,
						longer[i].centerX,
						longer[i].centerY
					);
					x = b[0];
					y = b[1];
					shorter[i++] = [x, y, x, y, x, y, x, y];
					shorter.totalPoints += 8;
					added++;
				}
			}

			for (i = 0; i < start.length; i++) {
				eb = end[i];
				sb = start[i];
				dif = eb.length - sb.length;

				if (dif < 0) {
					_subdivideSegmentQty(eb, (-dif / 6) | 0);
				} else if (dif > 0) {
					_subdivideSegmentQty(sb, (dif / 6) | 0);
				}

				if (reverse && fillSafe !== false && !sb.reversed) {
					reverseSegment(sb);
				}

				shapeIndex =
					shapeIndices[i] || shapeIndices[i] === 0
						? shapeIndices[i]
						: "auto";

				if (shapeIndex) {
					if (
						sb.closed ||
						(Math.abs(sb[0] - sb[sb.length - 2]) < 0.5 &&
							Math.abs(sb[1] - sb[sb.length - 1]) < 0.5)
					) {
						if (shapeIndex === "auto" || shapeIndex === "log") {
							shapeIndices[i] = shapeIndex =
								_getClosestShapeIndex(
									sb,
									eb,
									!i || fillSafe === false
								);

							if (shapeIndex < 0) {
								reverse = true;
								reverseSegment(sb);
								shapeIndex = -shapeIndex;
							}

							_offsetSegment(sb, shapeIndex * 6);
						} else if (shapeIndex !== "reverse") {
							if (i && shapeIndex < 0) {
								reverseSegment(sb);
							}

							_offsetSegment(
								sb,
								(shapeIndex < 0 ? -shapeIndex : shapeIndex) * 6
							);
						}
					} else if (
						!reverse &&
						((shapeIndex === "auto" &&
							Math.abs(eb[0] - sb[0]) +
								Math.abs(eb[1] - sb[1]) +
								Math.abs(
									eb[eb.length - 2] - sb[sb.length - 2]
								) +
								Math.abs(
									eb[eb.length - 1] - sb[sb.length - 1]
								) >
								Math.abs(eb[0] - sb[sb.length - 2]) +
									Math.abs(eb[1] - sb[sb.length - 1]) +
									Math.abs(eb[eb.length - 2] - sb[0]) +
									Math.abs(eb[eb.length - 1] - sb[1])) ||
							shapeIndex % 2)
					) {
						reverseSegment(sb);
						shapeIndices[i] = -1;
						reverse = true;
					} else if (shapeIndex === "auto") {
						shapeIndices[i] = 0;
					} else if (shapeIndex === "reverse") {
						shapeIndices[i] = -1;
					}

					if (sb.closed !== eb.closed) {
						sb.closed = eb.closed = false;
					}
				}
			}

			log && _log("shapeIndex:[" + shapeIndices.join(",") + "]");
			start.shapeIndex = shapeIndices;
			return shapeIndices;
		},
		_pathFilter = function _pathFilter(
			a,
			shapeIndex,
			map,
			precompile,
			fillSafe
		) {
			var start = stringToRawPath(a[0]),
				end = stringToRawPath(a[1]);

			if (
				!_equalizeSegmentQuantity(
					start,
					end,
					shapeIndex || shapeIndex === 0 ? shapeIndex : "auto",
					map,
					fillSafe
				)
			) {
				return;
			}

			a[0] = rawPathToString(start);
			a[1] = rawPathToString(end);

			if (precompile === "log" || precompile === true) {
				_log('precompile:["' + a[0] + '","' + a[1] + '"]');
			}
		},
		_offsetPoints = function _offsetPoints(text, offset) {
			if (!offset) {
				return text;
			}

			var a = text.match(_numExp) || [],
				l = a.length,
				s = "",
				inc,
				i,
				j;

			if (offset === "reverse") {
				i = l - 1;
				inc = -2;
			} else {
				i = ((parseInt(offset, 10) || 0) * 2 + 1 + l * 100) % l;
				inc = 2;
			}

			for (j = 0; j < l; j += 2) {
				s += a[i - 1] + "," + a[i] + " ";
				i = (i + inc) % l;
			}

			return s;
		},
		_equalizePointQuantity = function _equalizePointQuantity(a, quantity) {
			var tally = 0,
				x = parseFloat(a[0]),
				y = parseFloat(a[1]),
				s = x + "," + y + " ",
				max = 0.999999,
				newPointsPerSegment,
				i,
				l,
				j,
				factor,
				nextX,
				nextY;
			l = a.length;
			newPointsPerSegment = (quantity * 0.5) / (l * 0.5 - 1);

			for (i = 0; i < l - 2; i += 2) {
				tally += newPointsPerSegment;
				nextX = parseFloat(a[i + 2]);
				nextY = parseFloat(a[i + 3]);

				if (tally > max) {
					factor = 1 / (Math.floor(tally) + 1);
					j = 1;

					while (tally > max) {
						s +=
							(x + (nextX - x) * factor * j).toFixed(2) +
							"," +
							(y + (nextY - y) * factor * j).toFixed(2) +
							" ";
						tally--;
						j++;
					}
				}

				s += nextX + "," + nextY + " ";
				x = nextX;
				y = nextY;
			}

			return s;
		},
		_pointsFilter = function _pointsFilter(a) {
			var startNums = a[0].match(_numExp) || [],
				endNums = a[1].match(_numExp) || [],
				dif = endNums.length - startNums.length;

			if (dif > 0) {
				a[0] = _equalizePointQuantity(startNums, dif);
			} else {
				a[1] = _equalizePointQuantity(endNums, -dif);
			}
		},
		_buildPointsFilter = function _buildPointsFilter(shapeIndex) {
			return !isNaN(shapeIndex)
				? function (a) {
						_pointsFilter(a);

						a[1] = _offsetPoints(a[1], parseInt(shapeIndex, 10));
				  }
				: _pointsFilter;
		},
		_parseShape = function _parseShape(shape, forcePath, target) {
			var isString = typeof shape === "string",
				e,
				type;

			if (
				!isString ||
				_selectorExp$1.test(shape) ||
				(shape.match(_numExp) || []).length < 3
			) {
				e = _toArray(shape)[0];

				if (e) {
					type = (e.nodeName + "").toUpperCase();

					if (forcePath && type !== "PATH") {
						e = convertToPath(e, false);
						type = "PATH";
					}

					shape =
						e.getAttribute(type === "PATH" ? "d" : "points") || "";

					if (e === target) {
						shape =
							e.getAttributeNS(null, "data-original") || shape;
					}
				} else {
					_log("WARNING: invalid morph to: " + shape);

					shape = false;
				}
			}

			return shape;
		},
		_populateSmoothData = function _populateSmoothData(rawPath, tolerance) {
			var j = rawPath.length,
				limit = 0.2 * (tolerance || 1),
				smooth,
				segment,
				x,
				y,
				x2,
				y2,
				i,
				l,
				a,
				a2,
				isSmooth,
				smoothData;

			while (--j > -1) {
				segment = rawPath[j];
				isSmooth = segment.isSmooth = segment.isSmooth || [0, 0, 0, 0];
				smoothData = segment.smoothData = segment.smoothData || [
					0, 0, 0, 0,
				];
				isSmooth.length = 4;
				l = segment.length - 2;

				for (i = 6; i < l; i += 6) {
					x = segment[i] - segment[i - 2];
					y = segment[i + 1] - segment[i - 1];
					x2 = segment[i + 2] - segment[i];
					y2 = segment[i + 3] - segment[i + 1];
					a = _atan2(y, x);
					a2 = _atan2(y2, x2);
					smooth = Math.abs(a - a2) < limit;

					if (smooth) {
						smoothData[i - 2] = a;
						smoothData[i + 2] = a2;
						smoothData[i - 1] = _sqrt$1(x * x + y * y);
						smoothData[i + 3] = _sqrt$1(x2 * x2 + y2 * y2);
					}

					isSmooth.push(smooth, smooth, 0, 0, smooth, smooth);
				}

				if (
					segment[l] === segment[0] &&
					segment[l + 1] === segment[1]
				) {
					x = segment[0] - segment[l - 2];
					y = segment[1] - segment[l - 1];
					x2 = segment[2] - segment[0];
					y2 = segment[3] - segment[1];
					a = _atan2(y, x);
					a2 = _atan2(y2, x2);

					if (Math.abs(a - a2) < limit) {
						smoothData[l - 2] = a;
						smoothData[2] = a2;
						smoothData[l - 1] = _sqrt$1(x * x + y * y);
						smoothData[3] = _sqrt$1(x2 * x2 + y2 * y2);
						isSmooth[l - 2] = isSmooth[l - 1] = true;
					}
				}
			}

			return rawPath;
		},
		_parseOriginFactors = function _parseOriginFactors(v) {
			var a = v.trim().split(" "),
				x = ~v.indexOf("left")
					? 0
					: ~v.indexOf("right")
					? 100
					: isNaN(parseFloat(a[0]))
					? 50
					: parseFloat(a[0]),
				y = ~v.indexOf("top")
					? 0
					: ~v.indexOf("bottom")
					? 100
					: isNaN(parseFloat(a[1]))
					? 50
					: parseFloat(a[1]);
			return {
				x: x / 100,
				y: y / 100,
			};
		},
		_shortAngle = function _shortAngle(dif) {
			return dif !== dif % _PI ? dif + (dif < 0 ? _2PI : -_2PI) : dif;
		},
		_morphMessage =
			"Use MorphSVGPlugin.convertToPath() to convert to a path before morphing.",
		_tweenRotation = function _tweenRotation(start, end, i, linkedPT) {
			var so = this._origin,
				eo = this._eOrigin,
				dx = start[i] - so.x,
				dy = start[i + 1] - so.y,
				d = _sqrt$1(dx * dx + dy * dy),
				sa = _atan2(dy, dx),
				angleDif,
				_short;

			dx = end[i] - eo.x;
			dy = end[i + 1] - eo.y;
			angleDif = _atan2(dy, dx) - sa;
			_short = _shortAngle(angleDif);

			if (
				!linkedPT &&
				_lastLinkedAnchor &&
				Math.abs(_short + _lastLinkedAnchor.ca) < _angleMin
			) {
				linkedPT = _lastLinkedAnchor;
			}

			return (this._anchorPT = _lastLinkedAnchor =
				{
					_next: this._anchorPT,
					t: start,
					sa: sa,
					ca:
						linkedPT &&
						_short * linkedPT.ca < 0 &&
						Math.abs(_short) > _angleMax
							? angleDif
							: _short,
					sl: d,
					cl: _sqrt$1(dx * dx + dy * dy) - d,
					i: i,
				});
		},
		_initCore = function _initCore(required) {
			gsap = _getGSAP();
			PluginClass = PluginClass || (gsap && gsap.plugins.morphSVG);

			if (gsap && PluginClass) {
				_toArray = gsap.utils.toArray;
				PluginClass.prototype._tweenRotation = _tweenRotation;
				_coreInitted = 1;
			} else if (required) {
				_log("Please gsap.registerPlugin(MorphSVGPlugin)");
			}
		};

	var MorphSVGPlugin = {
		version: "3.10.4",
		name: "morphSVG",
		rawVars: 1,
		register: function register(core, Plugin) {
			gsap = core;
			PluginClass = Plugin;

			_initCore();
		},
		init: function init(target, value, tween, index, targets) {
			_coreInitted || _initCore(1);

			if (!value) {
				_log("invalid shape");

				return false;
			}

			_isFunction(value) &&
				(value = value.call(tween, index, target, targets));
			var type,
				p,
				pt,
				shape,
				isPoly,
				shapeIndex,
				map,
				startSmooth,
				endSmooth,
				start,
				end,
				i,
				j,
				l,
				startSeg,
				endSeg,
				precompiled,
				sData,
				eData,
				originFactors,
				useRotation,
				offset;

			if (typeof value === "string" || value.getBBox || value[0]) {
				value = {
					shape: value,
				};
			} else if (typeof value === "object") {
				type = {};

				for (p in value) {
					type[p] =
						_isFunction(value[p]) && p !== "render"
							? value[p].call(tween, index, target, targets)
							: value[p];
				}

				value = type;
			}

			var cs = target.nodeType ? window.getComputedStyle(target) : {},
				fill = cs.fill + "",
				fillSafe = !(
					fill === "none" ||
					(fill.match(_numExp) || [])[3] === "0" ||
					cs.fillRule === "evenodd"
				),
				origins = (value.origin || "50 50").split(",");
			type = (target.nodeName + "").toUpperCase();
			isPoly = type === "POLYLINE" || type === "POLYGON";

			if (type !== "PATH" && !isPoly && !value.prop) {
				_log("Cannot morph a <" + type + "> element. " + _morphMessage);

				return false;
			}

			p = type === "PATH" ? "d" : "points";

			if (!value.prop && !_isFunction(target.setAttribute)) {
				return false;
			}

			shape = _parseShape(
				value.shape || value.d || value.points || "",
				p === "d",
				target
			);

			if (isPoly && _commands.test(shape)) {
				_log(
					"A <" + type + "> cannot accept path data. " + _morphMessage
				);

				return false;
			}

			shapeIndex =
				value.shapeIndex || value.shapeIndex === 0
					? value.shapeIndex
					: "auto";
			map = value.map || MorphSVGPlugin.defaultMap;
			this._prop = value.prop;
			this._render = value.render || MorphSVGPlugin.defaultRender;
			this._apply =
				"updateTarget" in value
					? value.updateTarget
					: MorphSVGPlugin.defaultUpdateTarget;
			this._rnd = Math.pow(
				10,
				isNaN(value.precision) ? 2 : +value.precision
			);
			this._tween = tween;

			if (shape) {
				this._target = target;
				precompiled = typeof value.precompile === "object";
				start = this._prop
					? target[this._prop]
					: target.getAttribute(p);

				if (
					!this._prop &&
					!target.getAttributeNS(null, "data-original")
				) {
					target.setAttributeNS(null, "data-original", start);
				}

				if (p === "d" || this._prop) {
					start = stringToRawPath(
						precompiled ? value.precompile[0] : start
					);
					end = stringToRawPath(
						precompiled ? value.precompile[1] : shape
					);

					if (
						!precompiled &&
						!_equalizeSegmentQuantity(
							start,
							end,
							shapeIndex,
							map,
							fillSafe
						)
					) {
						return false;
					}

					if (
						value.precompile === "log" ||
						value.precompile === true
					) {
						_log(
							'precompile:["' +
								rawPathToString(start) +
								'","' +
								rawPathToString(end) +
								'"]'
						);
					}

					useRotation =
						(value.type || MorphSVGPlugin.defaultType) !== "linear";

					if (useRotation) {
						start = _populateSmoothData(
							start,
							value.smoothTolerance
						);
						end = _populateSmoothData(end, value.smoothTolerance);

						if (!start.size) {
							_getTotalSize(start);
						}

						if (!end.size) {
							_getTotalSize(end);
						}

						originFactors = _parseOriginFactors(origins[0]);
						this._origin = start.origin = {
							x: start.left + originFactors.x * start.width,
							y: start.top + originFactors.y * start.height,
						};

						if (origins[1]) {
							originFactors = _parseOriginFactors(origins[1]);
						}

						this._eOrigin = {
							x: end.left + originFactors.x * end.width,
							y: end.top + originFactors.y * end.height,
						};
					}

					this._rawPath = target._gsRawPath = start;
					j = start.length;

					while (--j > -1) {
						startSeg = start[j];
						endSeg = end[j];
						startSmooth = startSeg.isSmooth || [];
						endSmooth = endSeg.isSmooth || [];
						l = startSeg.length;
						_lastLinkedAnchor = 0;

						for (i = 0; i < l; i += 2) {
							if (
								endSeg[i] !== startSeg[i] ||
								endSeg[i + 1] !== startSeg[i + 1]
							) {
								if (useRotation) {
									if (startSmooth[i] && endSmooth[i]) {
										sData = startSeg.smoothData;
										eData = endSeg.smoothData;
										offset = i + (i === l - 4 ? 7 - l : 5);
										this._controlPT = {
											_next: this._controlPT,
											i: i,
											j: j,
											l1s: sData[i + 1],
											l1c: eData[i + 1] - sData[i + 1],
											l2s: sData[offset],
											l2c: eData[offset] - sData[offset],
										};
										pt = this._tweenRotation(
											startSeg,
											endSeg,
											i + 2
										);

										this._tweenRotation(
											startSeg,
											endSeg,
											i,
											pt
										);

										this._tweenRotation(
											startSeg,
											endSeg,
											offset - 1,
											pt
										);

										i += 4;
									} else {
										this._tweenRotation(
											startSeg,
											endSeg,
											i
										);
									}
								} else {
									pt = this.add(
										startSeg,
										i,
										startSeg[i],
										endSeg[i]
									);
									pt =
										this.add(
											startSeg,
											i + 1,
											startSeg[i + 1],
											endSeg[i + 1]
										) || pt;
								}
							}
						}
					}
				} else {
					pt = this.add(
						target,
						"setAttribute",
						target.getAttribute(p) + "",
						shape + "",
						index,
						targets,
						0,
						_buildPointsFilter(shapeIndex),
						p
					);
				}

				if (useRotation) {
					this.add(
						this._origin,
						"x",
						this._origin.x,
						this._eOrigin.x
					);
					pt = this.add(
						this._origin,
						"y",
						this._origin.y,
						this._eOrigin.y
					);
				}

				if (pt) {
					this._props.push("morphSVG");

					pt.end = shape;
					pt.endProp = p;
				}
			}

			return _bonusValidated;
		},
		render: function render(ratio, data) {
			var rawPath = data._rawPath,
				controlPT = data._controlPT,
				anchorPT = data._anchorPT,
				rnd = data._rnd,
				target = data._target,
				pt = data._pt,
				s,
				space,
				easeInOut,
				segment,
				l,
				angle,
				i,
				j,
				x,
				y,
				sin,
				cos,
				offset;

			while (pt) {
				pt.r(ratio, pt.d);
				pt = pt._next;
			}

			if (ratio === 1 && data._apply) {
				pt = data._pt;

				while (pt) {
					if (pt.end) {
						if (data._prop) {
							target[data._prop] = pt.end;
						} else {
							target.setAttribute(pt.endProp, pt.end);
						}
					}

					pt = pt._next;
				}
			} else if (rawPath) {
				while (anchorPT) {
					angle = anchorPT.sa + ratio * anchorPT.ca;
					l = anchorPT.sl + ratio * anchorPT.cl;
					anchorPT.t[anchorPT.i] = data._origin.x + _cos$1(angle) * l;
					anchorPT.t[anchorPT.i + 1] =
						data._origin.y + _sin$1(angle) * l;
					anchorPT = anchorPT._next;
				}

				easeInOut =
					ratio < 0.5
						? 2 * ratio * ratio
						: (4 - 2 * ratio) * ratio - 1;

				while (controlPT) {
					i = controlPT.i;
					segment = rawPath[controlPT.j];
					offset =
						i + (i === segment.length - 4 ? 7 - segment.length : 5);
					angle = _atan2(
						segment[offset] - segment[i + 1],
						segment[offset - 1] - segment[i]
					);
					sin = _sin$1(angle);
					cos = _cos$1(angle);
					x = segment[i + 2];
					y = segment[i + 3];
					l = controlPT.l1s + easeInOut * controlPT.l1c;
					segment[i] = x - cos * l;
					segment[i + 1] = y - sin * l;
					l = controlPT.l2s + easeInOut * controlPT.l2c;
					segment[offset - 1] = x + cos * l;
					segment[offset] = y + sin * l;
					controlPT = controlPT._next;
				}

				target._gsRawPath = rawPath;

				if (data._apply) {
					s = "";
					space = " ";

					for (j = 0; j < rawPath.length; j++) {
						segment = rawPath[j];
						l = segment.length;
						s +=
							"M" +
							((segment[0] * rnd) | 0) / rnd +
							space +
							((segment[1] * rnd) | 0) / rnd +
							" C";

						for (i = 2; i < l; i++) {
							s += ((segment[i] * rnd) | 0) / rnd + space;
						}
					}

					if (data._prop) {
						target[data._prop] = s;
					} else {
						target.setAttribute("d", s);
					}
				}
			}

			data._render &&
				rawPath &&
				data._render.call(data._tween, rawPath, target);
		},
		kill: function kill(property) {
			this._pt = this._rawPath = 0;
		},
		getRawPath: getRawPath,
		stringToRawPath: stringToRawPath,
		rawPathToString: rawPathToString,
		normalizeStrings: function normalizeStrings(shape1, shape2, _ref) {
			var shapeIndex = _ref.shapeIndex,
				map = _ref.map;
			var result = [shape1, shape2];

			_pathFilter(result, shapeIndex, map);

			return result;
		},
		pathFilter: _pathFilter,
		pointsFilter: _pointsFilter,
		getTotalSize: _getTotalSize,
		equalizeSegmentQuantity: _equalizeSegmentQuantity,
		convertToPath: function convertToPath$1(targets, swap) {
			return _toArray(targets).map(function (target) {
				return convertToPath(target, swap !== false);
			});
		},
		defaultType: "linear",
		defaultUpdateTarget: true,
		defaultMap: "size",
	};
	_getGSAP() && gsap.registerPlugin(MorphSVGPlugin);

	exports.MorphSVGPlugin = MorphSVGPlugin;
	exports.default = MorphSVGPlugin;

	Object.defineProperty(exports, "__esModule", { value: true });
});

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.window = global.window || {}));
}(this, (function (exports) { 'use strict';
 
  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;
    subClass.__proto__ = superClass;
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  /*!
   * GSAP 3.10.4
   * https://greensock.com
   *
   * @license Copyright 2008-2022, GreenSock. All rights reserved.
   * Subject to the terms at https://greensock.com/standard-license or for
   * Club GreenSock members, the agreement issued with that membership.
   * @author: Jack Doyle, jack@greensock.com
  */
  var _config = {
    autoSleep: 120,
    force3D: "auto",
    nullTargetWarn: 1,
    units: {
      lineHeight: ""
    }
  },
      _defaults = {
    duration: .5,
    overwrite: false,
    delay: 0
  },
      _suppressOverwrites,
      _bigNum = 1e8,
      _tinyNum = 1 / _bigNum,
      _2PI = Math.PI * 2,
      _HALF_PI = _2PI / 4,
      _gsID = 0,
      _sqrt = Math.sqrt,
      _cos = Math.cos,
      _sin = Math.sin,
      _isString = function _isString(value) {
    return typeof value === "string";
  },
      _isFunction = function _isFunction(value) {
    return typeof value === "function";
  },
      _isNumber = function _isNumber(value) {
    return typeof value === "number";
  },
      _isUndefined = function _isUndefined(value) {
    return typeof value === "undefined";
  },
      _isObject = function _isObject(value) {
    return typeof value === "object";
  },
      _isNotFalse = function _isNotFalse(value) {
    return value !== false;
  },
      _windowExists = function _windowExists() {
    return typeof window !== "undefined";
  },
      _isFuncOrString = function _isFuncOrString(value) {
    return _isFunction(value) || _isString(value);
  },
      _isTypedArray = typeof ArrayBuffer === "function" && ArrayBuffer.isView || function () {},
      _isArray = Array.isArray,
      _strictNumExp = /(?:-?\.?\d|\.)+/gi,
      _numExp = /[-+=.]*\d+[.e\-+]*\d*[e\-+]*\d*/g,
      _numWithUnitExp = /[-+=.]*\d+[.e-]*\d*[a-z%]*/g,
      _complexStringNumExp = /[-+=.]*\d+\.?\d*(?:e-|e\+)?\d*/gi,
      _relExp = /[+-]=-?[.\d]+/,
      _delimitedValueExp = /[^,'"\[\]\s]+/gi,
      _unitExp = /^[+\-=e\s\d]*\d+[.\d]*([a-z]*|%)\s*$/i,
      _globalTimeline,
      _win,
      _coreInitted,
      _doc,
      _globals = {},
      _installScope = {},
      _coreReady,
      _install = function _install(scope) {
    return (_installScope = _merge(scope, _globals)) && gsap;
  },
      _missingPlugin = function _missingPlugin(property, value) {
    return console.warn("Invalid property", property, "set to", value, "Missing plugin? gsap.registerPlugin()");
  },
      _warn = function _warn(message, suppress) {
    return !suppress && console.warn(message);
  },
      _addGlobal = function _addGlobal(name, obj) {
    return name && (_globals[name] = obj) && _installScope && (_installScope[name] = obj) || _globals;
  },
      _emptyFunc = function _emptyFunc() {
    return 0;
  },
      _reservedProps = {},
      _lazyTweens = [],
      _lazyLookup = {},
      _lastRenderedFrame,
      _plugins = {},
      _effects = {},
      _nextGCFrame = 30,
      _harnessPlugins = [],
      _callbackNames = "",
      _harness = function _harness(targets) {
    var target = targets[0],
        harnessPlugin,
        i;
    _isObject(target) || _isFunction(target) || (targets = [targets]);

    if (!(harnessPlugin = (target._gsap || {}).harness)) {
      i = _harnessPlugins.length;

      while (i-- && !_harnessPlugins[i].targetTest(target)) {}

      harnessPlugin = _harnessPlugins[i];
    }

    i = targets.length;

    while (i--) {
      targets[i] && (targets[i]._gsap || (targets[i]._gsap = new GSCache(targets[i], harnessPlugin))) || targets.splice(i, 1);
    }

    return targets;
  },
      _getCache = function _getCache(target) {
    return target._gsap || _harness(toArray(target))[0]._gsap;
  },
      _getProperty = function _getProperty(target, property, v) {
    return (v = target[property]) && _isFunction(v) ? target[property]() : _isUndefined(v) && target.getAttribute && target.getAttribute(property) || v;
  },
      _forEachName = function _forEachName(names, func) {
    return (names = names.split(",")).forEach(func) || names;
  },
      _round = function _round(value) {
    return Math.round(value * 100000) / 100000 || 0;
  },
      _roundPrecise = function _roundPrecise(value) {
    return Math.round(value * 10000000) / 10000000 || 0;
  },
      _parseRelative = function _parseRelative(start, value) {
    var operator = value.charAt(0),
        end = parseFloat(value.substr(2));
    start = parseFloat(start);
    return operator === "+" ? start + end : operator === "-" ? start - end : operator === "*" ? start * end : start / end;
  },
      _arrayContainsAny = function _arrayContainsAny(toSearch, toFind) {
    var l = toFind.length,
        i = 0;

    for (; toSearch.indexOf(toFind[i]) < 0 && ++i < l;) {}

    return i < l;
  },
      _lazyRender = function _lazyRender() {
    var l = _lazyTweens.length,
        a = _lazyTweens.slice(0),
        i,
        tween;

    _lazyLookup = {};
    _lazyTweens.length = 0;

    for (i = 0; i < l; i++) {
      tween = a[i];
      tween && tween._lazy && (tween.render(tween._lazy[0], tween._lazy[1], true)._lazy = 0);
    }
  },
      _lazySafeRender = function _lazySafeRender(animation, time, suppressEvents, force) {
    _lazyTweens.length && _lazyRender();
    animation.render(time, suppressEvents, force);
    _lazyTweens.length && _lazyRender();
  },
      _numericIfPossible = function _numericIfPossible(value) {
    var n = parseFloat(value);
    return (n || n === 0) && (value + "").match(_delimitedValueExp).length < 2 ? n : _isString(value) ? value.trim() : value;
  },
      _passThrough = function _passThrough(p) {
    return p;
  },
      _setDefaults = function _setDefaults(obj, defaults) {
    for (var p in defaults) {
      p in obj || (obj[p] = defaults[p]);
    }

    return obj;
  },
      _setKeyframeDefaults = function _setKeyframeDefaults(excludeDuration) {
    return function (obj, defaults) {
      for (var p in defaults) {
        p in obj || p === "duration" && excludeDuration || p === "ease" || (obj[p] = defaults[p]);
      }
    };
  },
      _merge = function _merge(base, toMerge) {
    for (var p in toMerge) {
      base[p] = toMerge[p];
    }

    return base;
  },
      _mergeDeep = function _mergeDeep(base, toMerge) {
    for (var p in toMerge) {
      p !== "__proto__" && p !== "constructor" && p !== "prototype" && (base[p] = _isObject(toMerge[p]) ? _mergeDeep(base[p] || (base[p] = {}), toMerge[p]) : toMerge[p]);
    }

    return base;
  },
      _copyExcluding = function _copyExcluding(obj, excluding) {
    var copy = {},
        p;

    for (p in obj) {
      p in excluding || (copy[p] = obj[p]);
    }

    return copy;
  },
      _inheritDefaults = function _inheritDefaults(vars) {
    var parent = vars.parent || _globalTimeline,
        func = vars.keyframes ? _setKeyframeDefaults(_isArray(vars.keyframes)) : _setDefaults;

    if (_isNotFalse(vars.inherit)) {
      while (parent) {
        func(vars, parent.vars.defaults);
        parent = parent.parent || parent._dp;
      }
    }

    return vars;
  },
      _arraysMatch = function _arraysMatch(a1, a2) {
    var i = a1.length,
        match = i === a2.length;

    while (match && i-- && a1[i] === a2[i]) {}

    return i < 0;
  },
      _addLinkedListItem = function _addLinkedListItem(parent, child, firstProp, lastProp, sortBy) {
    if (firstProp === void 0) {
      firstProp = "_first";
    }

    if (lastProp === void 0) {
      lastProp = "_last";
    }

    var prev = parent[lastProp],
        t;

    if (sortBy) {
      t = child[sortBy];

      while (prev && prev[sortBy] > t) {
        prev = prev._prev;
      }
    }

    if (prev) {
      child._next = prev._next;
      prev._next = child;
    } else {
      child._next = parent[firstProp];
      parent[firstProp] = child;
    }

    if (child._next) {
      child._next._prev = child;
    } else {
      parent[lastProp] = child;
    }

    child._prev = prev;
    child.parent = child._dp = parent;
    return child;
  },
      _removeLinkedListItem = function _removeLinkedListItem(parent, child, firstProp, lastProp) {
    if (firstProp === void 0) {
      firstProp = "_first";
    }

    if (lastProp === void 0) {
      lastProp = "_last";
    }

    var prev = child._prev,
        next = child._next;

    if (prev) {
      prev._next = next;
    } else if (parent[firstProp] === child) {
      parent[firstProp] = next;
    }

    if (next) {
      next._prev = prev;
    } else if (parent[lastProp] === child) {
      parent[lastProp] = prev;
    }

    child._next = child._prev = child.parent = null;
  },
      _removeFromParent = function _removeFromParent(child, onlyIfParentHasAutoRemove) {
    child.parent && (!onlyIfParentHasAutoRemove || child.parent.autoRemoveChildren) && child.parent.remove(child);
    child._act = 0;
  },
      _uncache = function _uncache(animation, child) {
    if (animation && (!child || child._end > animation._dur || child._start < 0)) {
      var a = animation;

      while (a) {
        a._dirty = 1;
        a = a.parent;
      }
    }

    return animation;
  },
      _recacheAncestors = function _recacheAncestors(animation) {
    var parent = animation.parent;

    while (parent && parent.parent) {
      parent._dirty = 1;
      parent.totalDuration();
      parent = parent.parent;
    }

    return animation;
  },
      _hasNoPausedAncestors = function _hasNoPausedAncestors(animation) {
    return !animation || animation._ts && _hasNoPausedAncestors(animation.parent);
  },
      _elapsedCycleDuration = function _elapsedCycleDuration(animation) {
    return animation._repeat ? _animationCycle(animation._tTime, animation = animation.duration() + animation._rDelay) * animation : 0;
  },
      _animationCycle = function _animationCycle(tTime, cycleDuration) {
    var whole = Math.floor(tTime /= cycleDuration);
    return tTime && whole === tTime ? whole - 1 : whole;
  },
      _parentToChildTotalTime = function _parentToChildTotalTime(parentTime, child) {
    return (parentTime - child._start) * child._ts + (child._ts >= 0 ? 0 : child._dirty ? child.totalDuration() : child._tDur);
  },
      _setEnd = function _setEnd(animation) {
    return animation._end = _roundPrecise(animation._start + (animation._tDur / Math.abs(animation._ts || animation._rts || _tinyNum) || 0));
  },
      _alignPlayhead = function _alignPlayhead(animation, totalTime) {
    var parent = animation._dp;

    if (parent && parent.smoothChildTiming && animation._ts) {
      animation._start = _roundPrecise(parent._time - (animation._ts > 0 ? totalTime / animation._ts : ((animation._dirty ? animation.totalDuration() : animation._tDur) - totalTime) / -animation._ts));

      _setEnd(animation);

      parent._dirty || _uncache(parent, animation);
    }

    return animation;
  },
      _postAddChecks = function _postAddChecks(timeline, child) {
    var t;

    if (child._time || child._initted && !child._dur) {
      t = _parentToChildTotalTime(timeline.rawTime(), child);

      if (!child._dur || _clamp(0, child.totalDuration(), t) - child._tTime > _tinyNum) {
        child.render(t, true);
      }
    }

    if (_uncache(timeline, child)._dp && timeline._initted && timeline._time >= timeline._dur && timeline._ts) {
      if (timeline._dur < timeline.duration()) {
        t = timeline;

        while (t._dp) {
          t.rawTime() >= 0 && t.totalTime(t._tTime);
          t = t._dp;
        }
      }

      timeline._zTime = -_tinyNum;
    }
  },
      _addToTimeline = function _addToTimeline(timeline, child, position, skipChecks) {
    child.parent && _removeFromParent(child);
    child._start = _roundPrecise((_isNumber(position) ? position : position || timeline !== _globalTimeline ? _parsePosition(timeline, position, child) : timeline._time) + child._delay);
    child._end = _roundPrecise(child._start + (child.totalDuration() / Math.abs(child.timeScale()) || 0));

    _addLinkedListItem(timeline, child, "_first", "_last", timeline._sort ? "_start" : 0);

    _isFromOrFromStart(child) || (timeline._recent = child);
    skipChecks || _postAddChecks(timeline, child);
    return timeline;
  },
      _scrollTrigger = function _scrollTrigger(animation, trigger) {
    return (_globals.ScrollTrigger || _missingPlugin("scrollTrigger", trigger)) && _globals.ScrollTrigger.create(trigger, animation);
  },
      _attemptInitTween = function _attemptInitTween(tween, totalTime, force, suppressEvents) {
    _initTween(tween, totalTime);

    if (!tween._initted) {
      return 1;
    }

    if (!force && tween._pt && (tween._dur && tween.vars.lazy !== false || !tween._dur && tween.vars.lazy) && _lastRenderedFrame !== _ticker.frame) {
      _lazyTweens.push(tween);

      tween._lazy = [totalTime, suppressEvents];
      return 1;
    }
  },
      _parentPlayheadIsBeforeStart = function _parentPlayheadIsBeforeStart(_ref) {
    var parent = _ref.parent;
    return parent && parent._ts && parent._initted && !parent._lock && (parent.rawTime() < 0 || _parentPlayheadIsBeforeStart(parent));
  },
      _isFromOrFromStart = function _isFromOrFromStart(_ref2) {
    var data = _ref2.data;
    return data === "isFromStart" || data === "isStart";
  },
      _renderZeroDurationTween = function _renderZeroDurationTween(tween, totalTime, suppressEvents, force) {
    var prevRatio = tween.ratio,
        ratio = totalTime < 0 || !totalTime && (!tween._start && _parentPlayheadIsBeforeStart(tween) && !(!tween._initted && _isFromOrFromStart(tween)) || (tween._ts < 0 || tween._dp._ts < 0) && !_isFromOrFromStart(tween)) ? 0 : 1,
        repeatDelay = tween._rDelay,
        tTime = 0,
        pt,
        iteration,
        prevIteration;

    if (repeatDelay && tween._repeat) {
      tTime = _clamp(0, tween._tDur, totalTime);
      iteration = _animationCycle(tTime, repeatDelay);
      tween._yoyo && iteration & 1 && (ratio = 1 - ratio);

      if (iteration !== _animationCycle(tween._tTime, repeatDelay)) {
        prevRatio = 1 - ratio;
        tween.vars.repeatRefresh && tween._initted && tween.invalidate();
      }
    }

    if (ratio !== prevRatio || force || tween._zTime === _tinyNum || !totalTime && tween._zTime) {
      if (!tween._initted && _attemptInitTween(tween, totalTime, force, suppressEvents)) {
        return;
      }

      prevIteration = tween._zTime;
      tween._zTime = totalTime || (suppressEvents ? _tinyNum : 0);
      suppressEvents || (suppressEvents = totalTime && !prevIteration);
      tween.ratio = ratio;
      tween._from && (ratio = 1 - ratio);
      tween._time = 0;
      tween._tTime = tTime;
      pt = tween._pt;

      while (pt) {
        pt.r(ratio, pt.d);
        pt = pt._next;
      }

      tween._startAt && totalTime < 0 && tween._startAt.render(totalTime, true, true);
      tween._onUpdate && !suppressEvents && _callback(tween, "onUpdate");
      tTime && tween._repeat && !suppressEvents && tween.parent && _callback(tween, "onRepeat");

      if ((totalTime >= tween._tDur || totalTime < 0) && tween.ratio === ratio) {
        ratio && _removeFromParent(tween, 1);

        if (!suppressEvents) {
          _callback(tween, ratio ? "onComplete" : "onReverseComplete", true);

          tween._prom && tween._prom();
        }
      }
    } else if (!tween._zTime) {
      tween._zTime = totalTime;
    }
  },
      _findNextPauseTween = function _findNextPauseTween(animation, prevTime, time) {
    var child;

    if (time > prevTime) {
      child = animation._first;

      while (child && child._start <= time) {
        if (child.data === "isPause" && child._start > prevTime) {
          return child;
        }

        child = child._next;
      }
    } else {
      child = animation._last;

      while (child && child._start >= time) {
        if (child.data === "isPause" && child._start < prevTime) {
          return child;
        }

        child = child._prev;
      }
    }
  },
      _setDuration = function _setDuration(animation, duration, skipUncache, leavePlayhead) {
    var repeat = animation._repeat,
        dur = _roundPrecise(duration) || 0,
        totalProgress = animation._tTime / animation._tDur;
    totalProgress && !leavePlayhead && (animation._time *= dur / animation._dur);
    animation._dur = dur;
    animation._tDur = !repeat ? dur : repeat < 0 ? 1e10 : _roundPrecise(dur * (repeat + 1) + animation._rDelay * repeat);
    totalProgress > 0 && !leavePlayhead ? _alignPlayhead(animation, animation._tTime = animation._tDur * totalProgress) : animation.parent && _setEnd(animation);
    skipUncache || _uncache(animation.parent, animation);
    return animation;
  },
      _onUpdateTotalDuration = function _onUpdateTotalDuration(animation) {
    return animation instanceof Timeline ? _uncache(animation) : _setDuration(animation, animation._dur);
  },
      _zeroPosition = {
    _start: 0,
    endTime: _emptyFunc,
    totalDuration: _emptyFunc
  },
      _parsePosition = function _parsePosition(animation, position, percentAnimation) {
    var labels = animation.labels,
        recent = animation._recent || _zeroPosition,
        clippedDuration = animation.duration() >= _bigNum ? recent.endTime(false) : animation._dur,
        i,
        offset,
        isPercent;

    if (_isString(position) && (isNaN(position) || position in labels)) {
      offset = position.charAt(0);
      isPercent = position.substr(-1) === "%";
      i = position.indexOf("=");

      if (offset === "<" || offset === ">") {
        i >= 0 && (position = position.replace(/=/, ""));
        return (offset === "<" ? recent._start : recent.endTime(recent._repeat >= 0)) + (parseFloat(position.substr(1)) || 0) * (isPercent ? (i < 0 ? recent : percentAnimation).totalDuration() / 100 : 1);
      }

      if (i < 0) {
        position in labels || (labels[position] = clippedDuration);
        return labels[position];
      }

      offset = parseFloat(position.charAt(i - 1) + position.substr(i + 1));

      if (isPercent && percentAnimation) {
        offset = offset / 100 * (_isArray(percentAnimation) ? percentAnimation[0] : percentAnimation).totalDuration();
      }

      return i > 1 ? _parsePosition(animation, position.substr(0, i - 1), percentAnimation) + offset : clippedDuration + offset;
    }

    return position == null ? clippedDuration : +position;
  },
      _createTweenType = function _createTweenType(type, params, timeline) {
    var isLegacy = _isNumber(params[1]),
        varsIndex = (isLegacy ? 2 : 1) + (type < 2 ? 0 : 1),
        vars = params[varsIndex],
        irVars,
        parent;

    isLegacy && (vars.duration = params[1]);
    vars.parent = timeline;

    if (type) {
      irVars = vars;
      parent = timeline;

      while (parent && !("immediateRender" in irVars)) {
        irVars = parent.vars.defaults || {};
        parent = _isNotFalse(parent.vars.inherit) && parent.parent;
      }

      vars.immediateRender = _isNotFalse(irVars.immediateRender);
      type < 2 ? vars.runBackwards = 1 : vars.startAt = params[varsIndex - 1];
    }

    return new Tween(params[0], vars, params[varsIndex + 1]);
  },
      _conditionalReturn = function _conditionalReturn(value, func) {
    return value || value === 0 ? func(value) : func;
  },
      _clamp = function _clamp(min, max, value) {
    return value < min ? min : value > max ? max : value;
  },
      getUnit = function getUnit(value, v) {
    return !_isString(value) || !(v = _unitExp.exec(value)) ? "" : v[1];
  },
      clamp = function clamp(min, max, value) {
    return _conditionalReturn(value, function (v) {
      return _clamp(min, max, v);
    });
  },
      _slice = [].slice,
      _isArrayLike = function _isArrayLike(value, nonEmpty) {
    return value && _isObject(value) && "length" in value && (!nonEmpty && !value.length || value.length - 1 in value && _isObject(value[0])) && !value.nodeType && value !== _win;
  },
      _flatten = function _flatten(ar, leaveStrings, accumulator) {
    if (accumulator === void 0) {
      accumulator = [];
    }

    return ar.forEach(function (value) {
      var _accumulator;

      return _isString(value) && !leaveStrings || _isArrayLike(value, 1) ? (_accumulator = accumulator).push.apply(_accumulator, toArray(value)) : accumulator.push(value);
    }) || accumulator;
  },
      toArray = function toArray(value, scope, leaveStrings) {
    return _isString(value) && !leaveStrings && (_coreInitted || !_wake()) ? _slice.call((scope || _doc).querySelectorAll(value), 0) : _isArray(value) ? _flatten(value, leaveStrings) : _isArrayLike(value) ? _slice.call(value, 0) : value ? [value] : [];
  },
      selector = function selector(value) {
    value = toArray(value)[0] || _warn("Invalid scope") || {};
    return function (v) {
      var el = value.current || value.nativeElement || value;
      return toArray(v, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") || _doc.createElement("div") : value);
    };
  },
      shuffle = function shuffle(a) {
    return a.sort(function () {
      return .5 - Math.random();
    });
  },
      distribute = function distribute(v) {
    if (_isFunction(v)) {
      return v;
    }

    var vars = _isObject(v) ? v : {
      each: v
    },
        ease = _parseEase(vars.ease),
        from = vars.from || 0,
        base = parseFloat(vars.base) || 0,
        cache = {},
        isDecimal = from > 0 && from < 1,
        ratios = isNaN(from) || isDecimal,
        axis = vars.axis,
        ratioX = from,
        ratioY = from;

    if (_isString(from)) {
      ratioX = ratioY = {
        center: .5,
        edges: .5,
        end: 1
      }[from] || 0;
    } else if (!isDecimal && ratios) {
      ratioX = from[0];
      ratioY = from[1];
    }

    return function (i, target, a) {
      var l = (a || vars).length,
          distances = cache[l],
          originX,
          originY,
          x,
          y,
          d,
          j,
          max,
          min,
          wrapAt;

      if (!distances) {
        wrapAt = vars.grid === "auto" ? 0 : (vars.grid || [1, _bigNum])[1];

        if (!wrapAt) {
          max = -_bigNum;

          while (max < (max = a[wrapAt++].getBoundingClientRect().left) && wrapAt < l) {}

          wrapAt--;
        }

        distances = cache[l] = [];
        originX = ratios ? Math.min(wrapAt, l) * ratioX - .5 : from % wrapAt;
        originY = wrapAt === _bigNum ? 0 : ratios ? l * ratioY / wrapAt - .5 : from / wrapAt | 0;
        max = 0;
        min = _bigNum;

        for (j = 0; j < l; j++) {
          x = j % wrapAt - originX;
          y = originY - (j / wrapAt | 0);
          distances[j] = d = !axis ? _sqrt(x * x + y * y) : Math.abs(axis === "y" ? y : x);
          d > max && (max = d);
          d < min && (min = d);
        }

        from === "random" && shuffle(distances);
        distances.max = max - min;
        distances.min = min;
        distances.v = l = (parseFloat(vars.amount) || parseFloat(vars.each) * (wrapAt > l ? l - 1 : !axis ? Math.max(wrapAt, l / wrapAt) : axis === "y" ? l / wrapAt : wrapAt) || 0) * (from === "edges" ? -1 : 1);
        distances.b = l < 0 ? base - l : base;
        distances.u = getUnit(vars.amount || vars.each) || 0;
        ease = ease && l < 0 ? _invertEase(ease) : ease;
      }

      l = (distances[i] - distances.min) / distances.max || 0;
      return _roundPrecise(distances.b + (ease ? ease(l) : l) * distances.v) + distances.u;
    };
  },
      _roundModifier = function _roundModifier(v) {
    var p = Math.pow(10, ((v + "").split(".")[1] || "").length);
    return function (raw) {
      var n = Math.round(parseFloat(raw) / v) * v * p;
      return (n - n % 1) / p + (_isNumber(raw) ? 0 : getUnit(raw));
    };
  },
      snap = function snap(snapTo, value) {
    var isArray = _isArray(snapTo),
        radius,
        is2D;

    if (!isArray && _isObject(snapTo)) {
      radius = isArray = snapTo.radius || _bigNum;

      if (snapTo.values) {
        snapTo = toArray(snapTo.values);

        if (is2D = !_isNumber(snapTo[0])) {
          radius *= radius;
        }
      } else {
        snapTo = _roundModifier(snapTo.increment);
      }
    }

    return _conditionalReturn(value, !isArray ? _roundModifier(snapTo) : _isFunction(snapTo) ? function (raw) {
      is2D = snapTo(raw);
      return Math.abs(is2D - raw) <= radius ? is2D : raw;
    } : function (raw) {
      var x = parseFloat(is2D ? raw.x : raw),
          y = parseFloat(is2D ? raw.y : 0),
          min = _bigNum,
          closest = 0,
          i = snapTo.length,
          dx,
          dy;

      while (i--) {
        if (is2D) {
          dx = snapTo[i].x - x;
          dy = snapTo[i].y - y;
          dx = dx * dx + dy * dy;
        } else {
          dx = Math.abs(snapTo[i] - x);
        }

        if (dx < min) {
          min = dx;
          closest = i;
        }
      }

      closest = !radius || min <= radius ? snapTo[closest] : raw;
      return is2D || closest === raw || _isNumber(raw) ? closest : closest + getUnit(raw);
    });
  },
      random = function random(min, max, roundingIncrement, returnFunction) {
    return _conditionalReturn(_isArray(min) ? !max : roundingIncrement === true ? !!(roundingIncrement = 0) : !returnFunction, function () {
      return _isArray(min) ? min[~~(Math.random() * min.length)] : (roundingIncrement = roundingIncrement || 1e-5) && (returnFunction = roundingIncrement < 1 ? Math.pow(10, (roundingIncrement + "").length - 2) : 1) && Math.floor(Math.round((min - roundingIncrement / 2 + Math.random() * (max - min + roundingIncrement * .99)) / roundingIncrement) * roundingIncrement * returnFunction) / returnFunction;
    });
  },
      pipe = function pipe() {
    for (var _len = arguments.length, functions = new Array(_len), _key = 0; _key < _len; _key++) {
      functions[_key] = arguments[_key];
    }

    return function (value) {
      return functions.reduce(function (v, f) {
        return f(v);
      }, value);
    };
  },
      unitize = function unitize(func, unit) {
    return function (value) {
      return func(parseFloat(value)) + (unit || getUnit(value));
    };
  },
      normalize = function normalize(min, max, value) {
    return mapRange(min, max, 0, 1, value);
  },
      _wrapArray = function _wrapArray(a, wrapper, value) {
    return _conditionalReturn(value, function (index) {
      return a[~~wrapper(index)];
    });
  },
      wrap = function wrap(min, max, value) {
    var range = max - min;
    return _isArray(min) ? _wrapArray(min, wrap(0, min.length), max) : _conditionalReturn(value, function (value) {
      return (range + (value - min) % range) % range + min;
    });
  },
      wrapYoyo = function wrapYoyo(min, max, value) {
    var range = max - min,
        total = range * 2;
    return _isArray(min) ? _wrapArray(min, wrapYoyo(0, min.length - 1), max) : _conditionalReturn(value, function (value) {
      value = (total + (value - min) % total) % total || 0;
      return min + (value > range ? total - value : value);
    });
  },
      _replaceRandom = function _replaceRandom(value) {
    var prev = 0,
        s = "",
        i,
        nums,
        end,
        isArray;

    while (~(i = value.indexOf("random(", prev))) {
      end = value.indexOf(")", i);
      isArray = value.charAt(i + 7) === "[";
      nums = value.substr(i + 7, end - i - 7).match(isArray ? _delimitedValueExp : _strictNumExp);
      s += value.substr(prev, i - prev) + random(isArray ? nums : +nums[0], isArray ? 0 : +nums[1], +nums[2] || 1e-5);
      prev = end + 1;
    }

    return s + value.substr(prev, value.length - prev);
  },
      mapRange = function mapRange(inMin, inMax, outMin, outMax, value) {
    var inRange = inMax - inMin,
        outRange = outMax - outMin;
    return _conditionalReturn(value, function (value) {
      return outMin + ((value - inMin) / inRange * outRange || 0);
    });
  },
      interpolate = function interpolate(start, end, progress, mutate) {
    var func = isNaN(start + end) ? 0 : function (p) {
      return (1 - p) * start + p * end;
    };

    if (!func) {
      var isString = _isString(start),
          master = {},
          p,
          i,
          interpolators,
          l,
          il;

      progress === true && (mutate = 1) && (progress = null);

      if (isString) {
        start = {
          p: start
        };
        end = {
          p: end
        };
      } else if (_isArray(start) && !_isArray(end)) {
        interpolators = [];
        l = start.length;
        il = l - 2;

        for (i = 1; i < l; i++) {
          interpolators.push(interpolate(start[i - 1], start[i]));
        }

        l--;

        func = function func(p) {
          p *= l;
          var i = Math.min(il, ~~p);
          return interpolators[i](p - i);
        };

        progress = end;
      } else if (!mutate) {
        start = _merge(_isArray(start) ? [] : {}, start);
      }

      if (!interpolators) {
        for (p in end) {
          _addPropTween.call(master, start, p, "get", end[p]);
        }

        func = function func(p) {
          return _renderPropTweens(p, master) || (isString ? start.p : start);
        };
      }
    }

    return _conditionalReturn(progress, func);
  },
      _getLabelInDirection = function _getLabelInDirection(timeline, fromTime, backward) {
    var labels = timeline.labels,
        min = _bigNum,
        p,
        distance,
        label;

    for (p in labels) {
      distance = labels[p] - fromTime;

      if (distance < 0 === !!backward && distance && min > (distance = Math.abs(distance))) {
        label = p;
        min = distance;
      }
    }

    return label;
  },
      _callback = function _callback(animation, type, executeLazyFirst) {
    var v = animation.vars,
        callback = v[type],
        params,
        scope;

    if (!callback) {
      return;
    }

    params = v[type + "Params"];
    scope = v.callbackScope || animation;
    executeLazyFirst && _lazyTweens.length && _lazyRender();
    return params ? callback.apply(scope, params) : callback.call(scope);
  },
      _interrupt = function _interrupt(animation) {
    _removeFromParent(animation);

    animation.scrollTrigger && animation.scrollTrigger.kill(false);
    animation.progress() < 1 && _callback(animation, "onInterrupt");
    return animation;
  },
      _quickTween,
      _createPlugin = function _createPlugin(config) {
    config = !config.name && config["default"] || config;

    var name = config.name,
        isFunc = _isFunction(config),
        Plugin = name && !isFunc && config.init ? function () {
      this._props = [];
    } : config,
        instanceDefaults = {
      init: _emptyFunc,
      render: _renderPropTweens,
      add: _addPropTween,
      kill: _killPropTweensOf,
      modifier: _addPluginModifier,
      rawVars: 0
    },
        statics = {
      targetTest: 0,
      get: 0,
      getSetter: _getSetter,
      aliases: {},
      register: 0
    };

    _wake();

    if (config !== Plugin) {
      if (_plugins[name]) {
        return;
      }

      _setDefaults(Plugin, _setDefaults(_copyExcluding(config, instanceDefaults), statics));

      _merge(Plugin.prototype, _merge(instanceDefaults, _copyExcluding(config, statics)));

      _plugins[Plugin.prop = name] = Plugin;

      if (config.targetTest) {
        _harnessPlugins.push(Plugin);

        _reservedProps[name] = 1;
      }

      name = (name === "css" ? "CSS" : name.charAt(0).toUpperCase() + name.substr(1)) + "Plugin";
    }

    _addGlobal(name, Plugin);

    config.register && config.register(gsap, Plugin, PropTween);
  },
      _255 = 255,
      _colorLookup = {
    aqua: [0, _255, _255],
    lime: [0, _255, 0],
    silver: [192, 192, 192],
    black: [0, 0, 0],
    maroon: [128, 0, 0],
    teal: [0, 128, 128],
    blue: [0, 0, _255],
    navy: [0, 0, 128],
    white: [_255, _255, _255],
    olive: [128, 128, 0],
    yellow: [_255, _255, 0],
    orange: [_255, 165, 0],
    gray: [128, 128, 128],
    purple: [128, 0, 128],
    green: [0, 128, 0],
    red: [_255, 0, 0],
    pink: [_255, 192, 203],
    cyan: [0, _255, _255],
    transparent: [_255, _255, _255, 0]
  },
      _hue = function _hue(h, m1, m2) {
    h += h < 0 ? 1 : h > 1 ? -1 : 0;
    return (h * 6 < 1 ? m1 + (m2 - m1) * h * 6 : h < .5 ? m2 : h * 3 < 2 ? m1 + (m2 - m1) * (2 / 3 - h) * 6 : m1) * _255 + .5 | 0;
  },
      splitColor = function splitColor(v, toHSL, forceAlpha) {
    var a = !v ? _colorLookup.black : _isNumber(v) ? [v >> 16, v >> 8 & _255, v & _255] : 0,
        r,
        g,
        b,
        h,
        s,
        l,
        max,
        min,
        d,
        wasHSL;

    if (!a) {
      if (v.substr(-1) === ",") {
        v = v.substr(0, v.length - 1);
      }

      if (_colorLookup[v]) {
        a = _colorLookup[v];
      } else if (v.charAt(0) === "#") {
        if (v.length < 6) {
          r = v.charAt(1);
          g = v.charAt(2);
          b = v.charAt(3);
          v = "#" + r + r + g + g + b + b + (v.length === 5 ? v.charAt(4) + v.charAt(4) : "");
        }

        if (v.length === 9) {
          a = parseInt(v.substr(1, 6), 16);
          return [a >> 16, a >> 8 & _255, a & _255, parseInt(v.substr(7), 16) / 255];
        }

        v = parseInt(v.substr(1), 16);
        a = [v >> 16, v >> 8 & _255, v & _255];
      } else if (v.substr(0, 3) === "hsl") {
        a = wasHSL = v.match(_strictNumExp);

        if (!toHSL) {
          h = +a[0] % 360 / 360;
          s = +a[1] / 100;
          l = +a[2] / 100;
          g = l <= .5 ? l * (s + 1) : l + s - l * s;
          r = l * 2 - g;
          a.length > 3 && (a[3] *= 1);
          a[0] = _hue(h + 1 / 3, r, g);
          a[1] = _hue(h, r, g);
          a[2] = _hue(h - 1 / 3, r, g);
        } else if (~v.indexOf("=")) {
          a = v.match(_numExp);
          forceAlpha && a.length < 4 && (a[3] = 1);
          return a;
        }
      } else {
        a = v.match(_strictNumExp) || _colorLookup.transparent;
      }

      a = a.map(Number);
    }

    if (toHSL && !wasHSL) {
      r = a[0] / _255;
      g = a[1] / _255;
      b = a[2] / _255;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }

      a[0] = ~~(h + .5);
      a[1] = ~~(s * 100 + .5);
      a[2] = ~~(l * 100 + .5);
    }

    forceAlpha && a.length < 4 && (a[3] = 1);
    return a;
  },
      _colorOrderData = function _colorOrderData(v) {
    var values = [],
        c = [],
        i = -1;
    v.split(_colorExp).forEach(function (v) {
      var a = v.match(_numWithUnitExp) || [];
      values.push.apply(values, a);
      c.push(i += a.length + 1);
    });
    values.c = c;
    return values;
  },
      _formatColors = function _formatColors(s, toHSL, orderMatchData) {
    var result = "",
        colors = (s + result).match(_colorExp),
        type = toHSL ? "hsla(" : "rgba(",
        i = 0,
        c,
        shell,
        d,
        l;

    if (!colors) {
      return s;
    }

    colors = colors.map(function (color) {
      return (color = splitColor(color, toHSL, 1)) && type + (toHSL ? color[0] + "," + color[1] + "%," + color[2] + "%," + color[3] : color.join(",")) + ")";
    });

    if (orderMatchData) {
      d = _colorOrderData(s);
      c = orderMatchData.c;

      if (c.join(result) !== d.c.join(result)) {
        shell = s.replace(_colorExp, "1").split(_numWithUnitExp);
        l = shell.length - 1;

        for (; i < l; i++) {
          result += shell[i] + (~c.indexOf(i) ? colors.shift() || type + "0,0,0,0)" : (d.length ? d : colors.length ? colors : orderMatchData).shift());
        }
      }
    }

    if (!shell) {
      shell = s.split(_colorExp);
      l = shell.length - 1;

      for (; i < l; i++) {
        result += shell[i] + colors[i];
      }
    }

    return result + shell[l];
  },
      _colorExp = function () {
    var s = "(?:\\b(?:(?:rgb|rgba|hsl|hsla)\\(.+?\\))|\\B#(?:[0-9a-f]{3,4}){1,2}\\b",
        p;

    for (p in _colorLookup) {
      s += "|" + p + "\\b";
    }

    return new RegExp(s + ")", "gi");
  }(),
      _hslExp = /hsl[a]?\(/,
      _colorStringFilter = function _colorStringFilter(a) {
    var combined = a.join(" "),
        toHSL;
    _colorExp.lastIndex = 0;

    if (_colorExp.test(combined)) {
      toHSL = _hslExp.test(combined);
      a[1] = _formatColors(a[1], toHSL);
      a[0] = _formatColors(a[0], toHSL, _colorOrderData(a[1]));
      return true;
    }
  },
      _tickerActive,
      _ticker = function () {
    var _getTime = Date.now,
        _lagThreshold = 500,
        _adjustedLag = 33,
        _startTime = _getTime(),
        _lastUpdate = _startTime,
        _gap = 1000 / 240,
        _nextTime = _gap,
        _listeners = [],
        _id,
        _req,
        _raf,
        _self,
        _delta,
        _i,
        _tick = function _tick(v) {
      var elapsed = _getTime() - _lastUpdate,
          manual = v === true,
          overlap,
          dispatch,
          time,
          frame;

      elapsed > _lagThreshold && (_startTime += elapsed - _adjustedLag);
      _lastUpdate += elapsed;
      time = _lastUpdate - _startTime;
      overlap = time - _nextTime;

      if (overlap > 0 || manual) {
        frame = ++_self.frame;
        _delta = time - _self.time * 1000;
        _self.time = time = time / 1000;
        _nextTime += overlap + (overlap >= _gap ? 4 : _gap - overlap);
        dispatch = 1;
      }

      manual || (_id = _req(_tick));

      if (dispatch) {
        for (_i = 0; _i < _listeners.length; _i++) {
          _listeners[_i](time, _delta, frame, v);
        }
      }
    };

    _self = {
      time: 0,
      frame: 0,
      tick: function tick() {
        _tick(true);
      },
      deltaRatio: function deltaRatio(fps) {
        return _delta / (1000 / (fps || 60));
      },
      wake: function wake() {
        if (_coreReady) {
          if (!_coreInitted && _windowExists()) {
            _win = _coreInitted = window;
            _doc = _win.document || {};
            _globals.gsap = gsap;
            (_win.gsapVersions || (_win.gsapVersions = [])).push(gsap.version);

            _install(_installScope || _win.GreenSockGlobals || !_win.gsap && _win || {});

            _raf = _win.requestAnimationFrame;
          }

          _id && _self.sleep();

          _req = _raf || function (f) {
            return setTimeout(f, _nextTime - _self.time * 1000 + 1 | 0);
          };

          _tickerActive = 1;

          _tick(2);
        }
      },
      sleep: function sleep() {
        (_raf ? _win.cancelAnimationFrame : clearTimeout)(_id);
        _tickerActive = 0;
        _req = _emptyFunc;
      },
      lagSmoothing: function lagSmoothing(threshold, adjustedLag) {
        _lagThreshold = threshold || 1 / _tinyNum;
        _adjustedLag = Math.min(adjustedLag, _lagThreshold, 0);
      },
      fps: function fps(_fps) {
        _gap = 1000 / (_fps || 240);
        _nextTime = _self.time * 1000 + _gap;
      },
      add: function add(callback, once, prioritize) {
        var func = once ? function (t, d, f, v) {
          callback(t, d, f, v);

          _self.remove(func);
        } : callback;

        _self.remove(callback);

        _listeners[prioritize ? "unshift" : "push"](func);

        _wake();

        return func;
      },
      remove: function remove(callback, i) {
        ~(i = _listeners.indexOf(callback)) && _listeners.splice(i, 1) && _i >= i && _i--;
      },
      _listeners: _listeners
    };
    return _self;
  }(),
      _wake = function _wake() {
    return !_tickerActive && _ticker.wake();
  },
      _easeMap = {},
      _customEaseExp = /^[\d.\-M][\d.\-,\s]/,
      _quotesExp = /["']/g,
      _parseObjectInString = function _parseObjectInString(value) {
    var obj = {},
        split = value.substr(1, value.length - 3).split(":"),
        key = split[0],
        i = 1,
        l = split.length,
        index,
        val,
        parsedVal;

    for (; i < l; i++) {
      val = split[i];
      index = i !== l - 1 ? val.lastIndexOf(",") : val.length;
      parsedVal = val.substr(0, index);
      obj[key] = isNaN(parsedVal) ? parsedVal.replace(_quotesExp, "").trim() : +parsedVal;
      key = val.substr(index + 1).trim();
    }

    return obj;
  },
      _valueInParentheses = function _valueInParentheses(value) {
    var open = value.indexOf("(") + 1,
        close = value.indexOf(")"),
        nested = value.indexOf("(", open);
    return value.substring(open, ~nested && nested < close ? value.indexOf(")", close + 1) : close);
  },
      _configEaseFromString = function _configEaseFromString(name) {
    var split = (name + "").split("("),
        ease = _easeMap[split[0]];
    return ease && split.length > 1 && ease.config ? ease.config.apply(null, ~name.indexOf("{") ? [_parseObjectInString(split[1])] : _valueInParentheses(name).split(",").map(_numericIfPossible)) : _easeMap._CE && _customEaseExp.test(name) ? _easeMap._CE("", name) : ease;
  },
      _invertEase = function _invertEase(ease) {
    return function (p) {
      return 1 - ease(1 - p);
    };
  },
      _propagateYoyoEase = function _propagateYoyoEase(timeline, isYoyo) {
    var child = timeline._first,
        ease;

    while (child) {
      if (child instanceof Timeline) {
        _propagateYoyoEase(child, isYoyo);
      } else if (child.vars.yoyoEase && (!child._yoyo || !child._repeat) && child._yoyo !== isYoyo) {
        if (child.timeline) {
          _propagateYoyoEase(child.timeline, isYoyo);
        } else {
          ease = child._ease;
          child._ease = child._yEase;
          child._yEase = ease;
          child._yoyo = isYoyo;
        }
      }

      child = child._next;
    }
  },
      _parseEase = function _parseEase(ease, defaultEase) {
    return !ease ? defaultEase : (_isFunction(ease) ? ease : _easeMap[ease] || _configEaseFromString(ease)) || defaultEase;
  },
      _insertEase = function _insertEase(names, easeIn, easeOut, easeInOut) {
    if (easeOut === void 0) {
      easeOut = function easeOut(p) {
        return 1 - easeIn(1 - p);
      };
    }

    if (easeInOut === void 0) {
      easeInOut = function easeInOut(p) {
        return p < .5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2;
      };
    }

    var ease = {
      easeIn: easeIn,
      easeOut: easeOut,
      easeInOut: easeInOut
    },
        lowercaseName;

    _forEachName(names, function (name) {
      _easeMap[name] = _globals[name] = ease;
      _easeMap[lowercaseName = name.toLowerCase()] = easeOut;

      for (var p in ease) {
        _easeMap[lowercaseName + (p === "easeIn" ? ".in" : p === "easeOut" ? ".out" : ".inOut")] = _easeMap[name + "." + p] = ease[p];
      }
    });

    return ease;
  },
      _easeInOutFromOut = function _easeInOutFromOut(easeOut) {
    return function (p) {
      return p < .5 ? (1 - easeOut(1 - p * 2)) / 2 : .5 + easeOut((p - .5) * 2) / 2;
    };
  },
      _configElastic = function _configElastic(type, amplitude, period) {
    var p1 = amplitude >= 1 ? amplitude : 1,
        p2 = (period || (type ? .3 : .45)) / (amplitude < 1 ? amplitude : 1),
        p3 = p2 / _2PI * (Math.asin(1 / p1) || 0),
        easeOut = function easeOut(p) {
      return p === 1 ? 1 : p1 * Math.pow(2, -10 * p) * _sin((p - p3) * p2) + 1;
    },
        ease = type === "out" ? easeOut : type === "in" ? function (p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);

    p2 = _2PI / p2;

    ease.config = function (amplitude, period) {
      return _configElastic(type, amplitude, period);
    };

    return ease;
  },
      _configBack = function _configBack(type, overshoot) {
    if (overshoot === void 0) {
      overshoot = 1.70158;
    }

    var easeOut = function easeOut(p) {
      return p ? --p * p * ((overshoot + 1) * p + overshoot) + 1 : 0;
    },
        ease = type === "out" ? easeOut : type === "in" ? function (p) {
      return 1 - easeOut(1 - p);
    } : _easeInOutFromOut(easeOut);

    ease.config = function (overshoot) {
      return _configBack(type, overshoot);
    };

    return ease;
  };

  _forEachName("Linear,Quad,Cubic,Quart,Quint,Strong", function (name, i) {
    var power = i < 5 ? i + 1 : i;

    _insertEase(name + ",Power" + (power - 1), i ? function (p) {
      return Math.pow(p, power);
    } : function (p) {
      return p;
    }, function (p) {
      return 1 - Math.pow(1 - p, power);
    }, function (p) {
      return p < .5 ? Math.pow(p * 2, power) / 2 : 1 - Math.pow((1 - p) * 2, power) / 2;
    });
  });

  _easeMap.Linear.easeNone = _easeMap.none = _easeMap.Linear.easeIn;

  _insertEase("Elastic", _configElastic("in"), _configElastic("out"), _configElastic());

  (function (n, c) {
    var n1 = 1 / c,
        n2 = 2 * n1,
        n3 = 2.5 * n1,
        easeOut = function easeOut(p) {
      return p < n1 ? n * p * p : p < n2 ? n * Math.pow(p - 1.5 / c, 2) + .75 : p < n3 ? n * (p -= 2.25 / c) * p + .9375 : n * Math.pow(p - 2.625 / c, 2) + .984375;
    };

    _insertEase("Bounce", function (p) {
      return 1 - easeOut(1 - p);
    }, easeOut);
  })(7.5625, 2.75);

  _insertEase("Expo", function (p) {
    return p ? Math.pow(2, 10 * (p - 1)) : 0;
  });

  _insertEase("Circ", function (p) {
    return -(_sqrt(1 - p * p) - 1);
  });

  _insertEase("Sine", function (p) {
    return p === 1 ? 1 : -_cos(p * _HALF_PI) + 1;
  });

  _insertEase("Back", _configBack("in"), _configBack("out"), _configBack());

  _easeMap.SteppedEase = _easeMap.steps = _globals.SteppedEase = {
    config: function config(steps, immediateStart) {
      if (steps === void 0) {
        steps = 1;
      }

      var p1 = 1 / steps,
          p2 = steps + (immediateStart ? 0 : 1),
          p3 = immediateStart ? 1 : 0,
          max = 1 - _tinyNum;
      return function (p) {
        return ((p2 * _clamp(0, max, p) | 0) + p3) * p1;
      };
    }
  };
  _defaults.ease = _easeMap["quad.out"];

  _forEachName("onComplete,onUpdate,onStart,onRepeat,onReverseComplete,onInterrupt", function (name) {
    return _callbackNames += name + "," + name + "Params,";
  });

  var GSCache = function GSCache(target, harness) {
    this.id = _gsID++;
    target._gsap = this;
    this.target = target;
    this.harness = harness;
    this.get = harness ? harness.get : _getProperty;
    this.set = harness ? harness.getSetter : _getSetter;
  };
  var Animation = function () {
    function Animation(vars) {
      this.vars = vars;
      this._delay = +vars.delay || 0;

      if (this._repeat = vars.repeat === Infinity ? -2 : vars.repeat || 0) {
        this._rDelay = vars.repeatDelay || 0;
        this._yoyo = !!vars.yoyo || !!vars.yoyoEase;
      }

      this._ts = 1;

      _setDuration(this, +vars.duration, 1, 1);

      this.data = vars.data;
      _tickerActive || _ticker.wake();
    }

    var _proto = Animation.prototype;

    _proto.delay = function delay(value) {
      if (value || value === 0) {
        this.parent && this.parent.smoothChildTiming && this.startTime(this._start + value - this._delay);
        this._delay = value;
        return this;
      }

      return this._delay;
    };

    _proto.duration = function duration(value) {
      return arguments.length ? this.totalDuration(this._repeat > 0 ? value + (value + this._rDelay) * this._repeat : value) : this.totalDuration() && this._dur;
    };

    _proto.totalDuration = function totalDuration(value) {
      if (!arguments.length) {
        return this._tDur;
      }

      this._dirty = 0;
      return _setDuration(this, this._repeat < 0 ? value : (value - this._repeat * this._rDelay) / (this._repeat + 1));
    };

    _proto.totalTime = function totalTime(_totalTime, suppressEvents) {
      _wake();

      if (!arguments.length) {
        return this._tTime;
      }

      var parent = this._dp;

      if (parent && parent.smoothChildTiming && this._ts) {
        _alignPlayhead(this, _totalTime);

        !parent._dp || parent.parent || _postAddChecks(parent, this);

        while (parent && parent.parent) {
          if (parent.parent._time !== parent._start + (parent._ts >= 0 ? parent._tTime / parent._ts : (parent.totalDuration() - parent._tTime) / -parent._ts)) {
            parent.totalTime(parent._tTime, true);
          }

          parent = parent.parent;
        }

        if (!this.parent && this._dp.autoRemoveChildren && (this._ts > 0 && _totalTime < this._tDur || this._ts < 0 && _totalTime > 0 || !this._tDur && !_totalTime)) {
          _addToTimeline(this._dp, this, this._start - this._delay);
        }
      }

      if (this._tTime !== _totalTime || !this._dur && !suppressEvents || this._initted && Math.abs(this._zTime) === _tinyNum || !_totalTime && !this._initted && (this.add || this._ptLookup)) {
        this._ts || (this._pTime = _totalTime);

        _lazySafeRender(this, _totalTime, suppressEvents);
      }

      return this;
    };

    _proto.time = function time(value, suppressEvents) {
      return arguments.length ? this.totalTime(Math.min(this.totalDuration(), value + _elapsedCycleDuration(this)) % (this._dur + this._rDelay) || (value ? this._dur : 0), suppressEvents) : this._time;
    };

    _proto.totalProgress = function totalProgress(value, suppressEvents) {
      return arguments.length ? this.totalTime(this.totalDuration() * value, suppressEvents) : this.totalDuration() ? Math.min(1, this._tTime / this._tDur) : this.ratio;
    };

    _proto.progress = function progress(value, suppressEvents) {
      return arguments.length ? this.totalTime(this.duration() * (this._yoyo && !(this.iteration() & 1) ? 1 - value : value) + _elapsedCycleDuration(this), suppressEvents) : this.duration() ? Math.min(1, this._time / this._dur) : this.ratio;
    };

    _proto.iteration = function iteration(value, suppressEvents) {
      var cycleDuration = this.duration() + this._rDelay;

      return arguments.length ? this.totalTime(this._time + (value - 1) * cycleDuration, suppressEvents) : this._repeat ? _animationCycle(this._tTime, cycleDuration) + 1 : 1;
    };

    _proto.timeScale = function timeScale(value) {
      if (!arguments.length) {
        return this._rts === -_tinyNum ? 0 : this._rts;
      }

      if (this._rts === value) {
        return this;
      }

      var tTime = this.parent && this._ts ? _parentToChildTotalTime(this.parent._time, this) : this._tTime;
      this._rts = +value || 0;
      this._ts = this._ps || value === -_tinyNum ? 0 : this._rts;
      this.totalTime(_clamp(-this._delay, this._tDur, tTime), true);

      _setEnd(this);

      return _recacheAncestors(this);
    };

    _proto.paused = function paused(value) {
      if (!arguments.length) {
        return this._ps;
      }

      if (this._ps !== value) {
        this._ps = value;

        if (value) {
          this._pTime = this._tTime || Math.max(-this._delay, this.rawTime());
          this._ts = this._act = 0;
        } else {
          _wake();

          this._ts = this._rts;
          this.totalTime(this.parent && !this.parent.smoothChildTiming ? this.rawTime() : this._tTime || this._pTime, this.progress() === 1 && Math.abs(this._zTime) !== _tinyNum && (this._tTime -= _tinyNum));
        }
      }

      return this;
    };

    _proto.startTime = function startTime(value) {
      if (arguments.length) {
        this._start = value;
        var parent = this.parent || this._dp;
        parent && (parent._sort || !this.parent) && _addToTimeline(parent, this, value - this._delay);
        return this;
      }

      return this._start;
    };

    _proto.endTime = function endTime(includeRepeats) {
      return this._start + (_isNotFalse(includeRepeats) ? this.totalDuration() : this.duration()) / Math.abs(this._ts || 1);
    };

    _proto.rawTime = function rawTime(wrapRepeats) {
      var parent = this.parent || this._dp;
      return !parent ? this._tTime : wrapRepeats && (!this._ts || this._repeat && this._time && this.totalProgress() < 1) ? this._tTime % (this._dur + this._rDelay) : !this._ts ? this._tTime : _parentToChildTotalTime(parent.rawTime(wrapRepeats), this);
    };

    _proto.globalTime = function globalTime(rawTime) {
      var animation = this,
          time = arguments.length ? rawTime : animation.rawTime();

      while (animation) {
        time = animation._start + time / (animation._ts || 1);
        animation = animation._dp;
      }

      return time;
    };

    _proto.repeat = function repeat(value) {
      if (arguments.length) {
        this._repeat = value === Infinity ? -2 : value;
        return _onUpdateTotalDuration(this);
      }

      return this._repeat === -2 ? Infinity : this._repeat;
    };

    _proto.repeatDelay = function repeatDelay(value) {
      if (arguments.length) {
        var time = this._time;
        this._rDelay = value;

        _onUpdateTotalDuration(this);

        return time ? this.time(time) : this;
      }

      return this._rDelay;
    };

    _proto.yoyo = function yoyo(value) {
      if (arguments.length) {
        this._yoyo = value;
        return this;
      }

      return this._yoyo;
    };

    _proto.seek = function seek(position, suppressEvents) {
      return this.totalTime(_parsePosition(this, position), _isNotFalse(suppressEvents));
    };

    _proto.restart = function restart(includeDelay, suppressEvents) {
      return this.play().totalTime(includeDelay ? -this._delay : 0, _isNotFalse(suppressEvents));
    };

    _proto.play = function play(from, suppressEvents) {
      from != null && this.seek(from, suppressEvents);
      return this.reversed(false).paused(false);
    };

    _proto.reverse = function reverse(from, suppressEvents) {
      from != null && this.seek(from || this.totalDuration(), suppressEvents);
      return this.reversed(true).paused(false);
    };

    _proto.pause = function pause(atTime, suppressEvents) {
      atTime != null && this.seek(atTime, suppressEvents);
      return this.paused(true);
    };

    _proto.resume = function resume() {
      return this.paused(false);
    };

    _proto.reversed = function reversed(value) {
      if (arguments.length) {
        !!value !== this.reversed() && this.timeScale(-this._rts || (value ? -_tinyNum : 0));
        return this;
      }

      return this._rts < 0;
    };

    _proto.invalidate = function invalidate() {
      this._initted = this._act = 0;
      this._zTime = -_tinyNum;
      return this;
    };

    _proto.isActive = function isActive() {
      var parent = this.parent || this._dp,
          start = this._start,
          rawTime;
      return !!(!parent || this._ts && this._initted && parent.isActive() && (rawTime = parent.rawTime(true)) >= start && rawTime < this.endTime(true) - _tinyNum);
    };

    _proto.eventCallback = function eventCallback(type, callback, params) {
      var vars = this.vars;

      if (arguments.length > 1) {
        if (!callback) {
          delete vars[type];
        } else {
          vars[type] = callback;
          params && (vars[type + "Params"] = params);
          type === "onUpdate" && (this._onUpdate = callback);
        }

        return this;
      }

      return vars[type];
    };

    _proto.then = function then(onFulfilled) {
      var self = this;
      return new Promise(function (resolve) {
        var f = _isFunction(onFulfilled) ? onFulfilled : _passThrough,
            _resolve = function _resolve() {
          var _then = self.then;
          self.then = null;
          _isFunction(f) && (f = f(self)) && (f.then || f === self) && (self.then = _then);
          resolve(f);
          self.then = _then;
        };

        if (self._initted && self.totalProgress() === 1 && self._ts >= 0 || !self._tTime && self._ts < 0) {
          _resolve();
        } else {
          self._prom = _resolve;
        }
      });
    };

    _proto.kill = function kill() {
      _interrupt(this);
    };

    return Animation;
  }();

  _setDefaults(Animation.prototype, {
    _time: 0,
    _start: 0,
    _end: 0,
    _tTime: 0,
    _tDur: 0,
    _dirty: 0,
    _repeat: 0,
    _yoyo: false,
    parent: null,
    _initted: false,
    _rDelay: 0,
    _ts: 1,
    _dp: 0,
    ratio: 0,
    _zTime: -_tinyNum,
    _prom: 0,
    _ps: false,
    _rts: 1
  });

  var Timeline = function (_Animation) {
    _inheritsLoose(Timeline, _Animation);

    function Timeline(vars, position) {
      var _this;

      if (vars === void 0) {
        vars = {};
      }

      _this = _Animation.call(this, vars) || this;
      _this.labels = {};
      _this.smoothChildTiming = !!vars.smoothChildTiming;
      _this.autoRemoveChildren = !!vars.autoRemoveChildren;
      _this._sort = _isNotFalse(vars.sortChildren);
      _globalTimeline && _addToTimeline(vars.parent || _globalTimeline, _assertThisInitialized(_this), position);
      vars.reversed && _this.reverse();
      vars.paused && _this.paused(true);
      vars.scrollTrigger && _scrollTrigger(_assertThisInitialized(_this), vars.scrollTrigger);
      return _this;
    }

    var _proto2 = Timeline.prototype;

    _proto2.to = function to(targets, vars, position) {
      _createTweenType(0, arguments, this);

      return this;
    };

    _proto2.from = function from(targets, vars, position) {
      _createTweenType(1, arguments, this);

      return this;
    };

    _proto2.fromTo = function fromTo(targets, fromVars, toVars, position) {
      _createTweenType(2, arguments, this);

      return this;
    };

    _proto2.set = function set(targets, vars, position) {
      vars.duration = 0;
      vars.parent = this;
      _inheritDefaults(vars).repeatDelay || (vars.repeat = 0);
      vars.immediateRender = !!vars.immediateRender;
      new Tween(targets, vars, _parsePosition(this, position), 1);
      return this;
    };

    _proto2.call = function call(callback, params, position) {
      return _addToTimeline(this, Tween.delayedCall(0, callback, params), position);
    };

    _proto2.staggerTo = function staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
      vars.duration = duration;
      vars.stagger = vars.stagger || stagger;
      vars.onComplete = onCompleteAll;
      vars.onCompleteParams = onCompleteAllParams;
      vars.parent = this;
      new Tween(targets, vars, _parsePosition(this, position));
      return this;
    };

    _proto2.staggerFrom = function staggerFrom(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams) {
      vars.runBackwards = 1;
      _inheritDefaults(vars).immediateRender = _isNotFalse(vars.immediateRender);
      return this.staggerTo(targets, duration, vars, stagger, position, onCompleteAll, onCompleteAllParams);
    };

    _proto2.staggerFromTo = function staggerFromTo(targets, duration, fromVars, toVars, stagger, position, onCompleteAll, onCompleteAllParams) {
      toVars.startAt = fromVars;
      _inheritDefaults(toVars).immediateRender = _isNotFalse(toVars.immediateRender);
      return this.staggerTo(targets, duration, toVars, stagger, position, onCompleteAll, onCompleteAllParams);
    };

    _proto2.render = function render(totalTime, suppressEvents, force) {
      var prevTime = this._time,
          tDur = this._dirty ? this.totalDuration() : this._tDur,
          dur = this._dur,
          tTime = totalTime <= 0 ? 0 : _roundPrecise(totalTime),
          crossingStart = this._zTime < 0 !== totalTime < 0 && (this._initted || !dur),
          time,
          child,
          next,
          iteration,
          cycleDuration,
          prevPaused,
          pauseTween,
          timeScale,
          prevStart,
          prevIteration,
          yoyo,
          isYoyo;
      this !== _globalTimeline && tTime > tDur && totalTime >= 0 && (tTime = tDur);

      if (tTime !== this._tTime || force || crossingStart) {
        if (prevTime !== this._time && dur) {
          tTime += this._time - prevTime;
          totalTime += this._time - prevTime;
        }

        time = tTime;
        prevStart = this._start;
        timeScale = this._ts;
        prevPaused = !timeScale;

        if (crossingStart) {
          dur || (prevTime = this._zTime);
          (totalTime || !suppressEvents) && (this._zTime = totalTime);
        }

        if (this._repeat) {
          yoyo = this._yoyo;
          cycleDuration = dur + this._rDelay;

          if (this._repeat < -1 && totalTime < 0) {
            return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
          }

          time = _roundPrecise(tTime % cycleDuration);

          if (tTime === tDur) {
            iteration = this._repeat;
            time = dur;
          } else {
            iteration = ~~(tTime / cycleDuration);

            if (iteration && iteration === tTime / cycleDuration) {
              time = dur;
              iteration--;
            }

            time > dur && (time = dur);
          }

          prevIteration = _animationCycle(this._tTime, cycleDuration);
          !prevTime && this._tTime && prevIteration !== iteration && (prevIteration = iteration);

          if (yoyo && iteration & 1) {
            time = dur - time;
            isYoyo = 1;
          }

          if (iteration !== prevIteration && !this._lock) {
            var rewinding = yoyo && prevIteration & 1,
                doesWrap = rewinding === (yoyo && iteration & 1);
            iteration < prevIteration && (rewinding = !rewinding);
            prevTime = rewinding ? 0 : dur;
            this._lock = 1;
            this.render(prevTime || (isYoyo ? 0 : _roundPrecise(iteration * cycleDuration)), suppressEvents, !dur)._lock = 0;
            this._tTime = tTime;
            !suppressEvents && this.parent && _callback(this, "onRepeat");
            this.vars.repeatRefresh && !isYoyo && (this.invalidate()._lock = 1);

            if (prevTime && prevTime !== this._time || prevPaused !== !this._ts || this.vars.onRepeat && !this.parent && !this._act) {
              return this;
            }

            dur = this._dur;
            tDur = this._tDur;

            if (doesWrap) {
              this._lock = 2;
              prevTime = rewinding ? dur : -0.0001;
              this.render(prevTime, true);
              this.vars.repeatRefresh && !isYoyo && this.invalidate();
            }

            this._lock = 0;

            if (!this._ts && !prevPaused) {
              return this;
            }

            _propagateYoyoEase(this, isYoyo);
          }
        }

        if (this._hasPause && !this._forcing && this._lock < 2) {
          pauseTween = _findNextPauseTween(this, _roundPrecise(prevTime), _roundPrecise(time));

          if (pauseTween) {
            tTime -= time - (time = pauseTween._start);
          }
        }

        this._tTime = tTime;
        this._time = time;
        this._act = !timeScale;

        if (!this._initted) {
          this._onUpdate = this.vars.onUpdate;
          this._initted = 1;
          this._zTime = totalTime;
          prevTime = 0;
        }

        if (!prevTime && time && !suppressEvents) {
          _callback(this, "onStart");

          if (this._tTime !== tTime) {
            return this;
          }
        }

        if (time >= prevTime && totalTime >= 0) {
          child = this._first;

          while (child) {
            next = child._next;

            if ((child._act || time >= child._start) && child._ts && pauseTween !== child) {
              if (child.parent !== this) {
                return this.render(totalTime, suppressEvents, force);
              }

              child.render(child._ts > 0 ? (time - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (time - child._start) * child._ts, suppressEvents, force);

              if (time !== this._time || !this._ts && !prevPaused) {
                pauseTween = 0;
                next && (tTime += this._zTime = -_tinyNum);
                break;
              }
            }

            child = next;
          }
        } else {
          child = this._last;
          var adjustedTime = totalTime < 0 ? totalTime : time;

          while (child) {
            next = child._prev;

            if ((child._act || adjustedTime <= child._end) && child._ts && pauseTween !== child) {
              if (child.parent !== this) {
                return this.render(totalTime, suppressEvents, force);
              }

              child.render(child._ts > 0 ? (adjustedTime - child._start) * child._ts : (child._dirty ? child.totalDuration() : child._tDur) + (adjustedTime - child._start) * child._ts, suppressEvents, force);

              if (time !== this._time || !this._ts && !prevPaused) {
                pauseTween = 0;
                next && (tTime += this._zTime = adjustedTime ? -_tinyNum : _tinyNum);
                break;
              }
            }

            child = next;
          }
        }

        if (pauseTween && !suppressEvents) {
          this.pause();
          pauseTween.render(time >= prevTime ? 0 : -_tinyNum)._zTime = time >= prevTime ? 1 : -1;

          if (this._ts) {
            this._start = prevStart;

            _setEnd(this);

            return this.render(totalTime, suppressEvents, force);
          }
        }

        this._onUpdate && !suppressEvents && _callback(this, "onUpdate", true);
        if (tTime === tDur && this._tTime >= this.totalDuration() || !tTime && prevTime) if (prevStart === this._start || Math.abs(timeScale) !== Math.abs(this._ts)) if (!this._lock) {
          (totalTime || !dur) && (tTime === tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

          if (!suppressEvents && !(totalTime < 0 && !prevTime) && (tTime || prevTime || !tDur)) {
            _callback(this, tTime === tDur && totalTime >= 0 ? "onComplete" : "onReverseComplete", true);

            this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
          }
        }
      }

      return this;
    };

    _proto2.add = function add(child, position) {
      var _this2 = this;

      _isNumber(position) || (position = _parsePosition(this, position, child));

      if (!(child instanceof Animation)) {
        if (_isArray(child)) {
          child.forEach(function (obj) {
            return _this2.add(obj, position);
          });
          return this;
        }

        if (_isString(child)) {
          return this.addLabel(child, position);
        }

        if (_isFunction(child)) {
          child = Tween.delayedCall(0, child);
        } else {
          return this;
        }
      }

      return this !== child ? _addToTimeline(this, child, position) : this;
    };

    _proto2.getChildren = function getChildren(nested, tweens, timelines, ignoreBeforeTime) {
      if (nested === void 0) {
        nested = true;
      }

      if (tweens === void 0) {
        tweens = true;
      }

      if (timelines === void 0) {
        timelines = true;
      }

      if (ignoreBeforeTime === void 0) {
        ignoreBeforeTime = -_bigNum;
      }

      var a = [],
          child = this._first;

      while (child) {
        if (child._start >= ignoreBeforeTime) {
          if (child instanceof Tween) {
            tweens && a.push(child);
          } else {
            timelines && a.push(child);
            nested && a.push.apply(a, child.getChildren(true, tweens, timelines));
          }
        }

        child = child._next;
      }

      return a;
    };

    _proto2.getById = function getById(id) {
      var animations = this.getChildren(1, 1, 1),
          i = animations.length;

      while (i--) {
        if (animations[i].vars.id === id) {
          return animations[i];
        }
      }
    };

    _proto2.remove = function remove(child) {
      if (_isString(child)) {
        return this.removeLabel(child);
      }

      if (_isFunction(child)) {
        return this.killTweensOf(child);
      }

      _removeLinkedListItem(this, child);

      if (child === this._recent) {
        this._recent = this._last;
      }

      return _uncache(this);
    };

    _proto2.totalTime = function totalTime(_totalTime2, suppressEvents) {
      if (!arguments.length) {
        return this._tTime;
      }

      this._forcing = 1;

      if (!this._dp && this._ts) {
        this._start = _roundPrecise(_ticker.time - (this._ts > 0 ? _totalTime2 / this._ts : (this.totalDuration() - _totalTime2) / -this._ts));
      }

      _Animation.prototype.totalTime.call(this, _totalTime2, suppressEvents);

      this._forcing = 0;
      return this;
    };

    _proto2.addLabel = function addLabel(label, position) {
      this.labels[label] = _parsePosition(this, position);
      return this;
    };

    _proto2.removeLabel = function removeLabel(label) {
      delete this.labels[label];
      return this;
    };

    _proto2.addPause = function addPause(position, callback, params) {
      var t = Tween.delayedCall(0, callback || _emptyFunc, params);
      t.data = "isPause";
      this._hasPause = 1;
      return _addToTimeline(this, t, _parsePosition(this, position));
    };

    _proto2.removePause = function removePause(position) {
      var child = this._first;
      position = _parsePosition(this, position);

      while (child) {
        if (child._start === position && child.data === "isPause") {
          _removeFromParent(child);
        }

        child = child._next;
      }
    };

    _proto2.killTweensOf = function killTweensOf(targets, props, onlyActive) {
      var tweens = this.getTweensOf(targets, onlyActive),
          i = tweens.length;

      while (i--) {
        _overwritingTween !== tweens[i] && tweens[i].kill(targets, props);
      }

      return this;
    };

    _proto2.getTweensOf = function getTweensOf(targets, onlyActive) {
      var a = [],
          parsedTargets = toArray(targets),
          child = this._first,
          isGlobalTime = _isNumber(onlyActive),
          children;

      while (child) {
        if (child instanceof Tween) {
          if (_arrayContainsAny(child._targets, parsedTargets) && (isGlobalTime ? (!_overwritingTween || child._initted && child._ts) && child.globalTime(0) <= onlyActive && child.globalTime(child.totalDuration()) > onlyActive : !onlyActive || child.isActive())) {
            a.push(child);
          }
        } else if ((children = child.getTweensOf(parsedTargets, onlyActive)).length) {
          a.push.apply(a, children);
        }

        child = child._next;
      }

      return a;
    };

    _proto2.tweenTo = function tweenTo(position, vars) {
      vars = vars || {};

      var tl = this,
          endTime = _parsePosition(tl, position),
          _vars = vars,
          startAt = _vars.startAt,
          _onStart = _vars.onStart,
          onStartParams = _vars.onStartParams,
          immediateRender = _vars.immediateRender,
          initted,
          tween = Tween.to(tl, _setDefaults({
        ease: vars.ease || "none",
        lazy: false,
        immediateRender: false,
        time: endTime,
        overwrite: "auto",
        duration: vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale()) || _tinyNum,
        onStart: function onStart() {
          tl.pause();

          if (!initted) {
            var duration = vars.duration || Math.abs((endTime - (startAt && "time" in startAt ? startAt.time : tl._time)) / tl.timeScale());
            tween._dur !== duration && _setDuration(tween, duration, 0, 1).render(tween._time, true, true);
            initted = 1;
          }

          _onStart && _onStart.apply(tween, onStartParams || []);
        }
      }, vars));

      return immediateRender ? tween.render(0) : tween;
    };

    _proto2.tweenFromTo = function tweenFromTo(fromPosition, toPosition, vars) {
      return this.tweenTo(toPosition, _setDefaults({
        startAt: {
          time: _parsePosition(this, fromPosition)
        }
      }, vars));
    };

    _proto2.recent = function recent() {
      return this._recent;
    };

    _proto2.nextLabel = function nextLabel(afterTime) {
      if (afterTime === void 0) {
        afterTime = this._time;
      }

      return _getLabelInDirection(this, _parsePosition(this, afterTime));
    };

    _proto2.previousLabel = function previousLabel(beforeTime) {
      if (beforeTime === void 0) {
        beforeTime = this._time;
      }

      return _getLabelInDirection(this, _parsePosition(this, beforeTime), 1);
    };

    _proto2.currentLabel = function currentLabel(value) {
      return arguments.length ? this.seek(value, true) : this.previousLabel(this._time + _tinyNum);
    };

    _proto2.shiftChildren = function shiftChildren(amount, adjustLabels, ignoreBeforeTime) {
      if (ignoreBeforeTime === void 0) {
        ignoreBeforeTime = 0;
      }

      var child = this._first,
          labels = this.labels,
          p;

      while (child) {
        if (child._start >= ignoreBeforeTime) {
          child._start += amount;
          child._end += amount;
        }

        child = child._next;
      }

      if (adjustLabels) {
        for (p in labels) {
          if (labels[p] >= ignoreBeforeTime) {
            labels[p] += amount;
          }
        }
      }

      return _uncache(this);
    };

    _proto2.invalidate = function invalidate() {
      var child = this._first;
      this._lock = 0;

      while (child) {
        child.invalidate();
        child = child._next;
      }

      return _Animation.prototype.invalidate.call(this);
    };

    _proto2.clear = function clear(includeLabels) {
      if (includeLabels === void 0) {
        includeLabels = true;
      }

      var child = this._first,
          next;

      while (child) {
        next = child._next;
        this.remove(child);
        child = next;
      }

      this._dp && (this._time = this._tTime = this._pTime = 0);
      includeLabels && (this.labels = {});
      return _uncache(this);
    };

    _proto2.totalDuration = function totalDuration(value) {
      var max = 0,
          self = this,
          child = self._last,
          prevStart = _bigNum,
          prev,
          start,
          parent;

      if (arguments.length) {
        return self.timeScale((self._repeat < 0 ? self.duration() : self.totalDuration()) / (self.reversed() ? -value : value));
      }

      if (self._dirty) {
        parent = self.parent;

        while (child) {
          prev = child._prev;
          child._dirty && child.totalDuration();
          start = child._start;

          if (start > prevStart && self._sort && child._ts && !self._lock) {
            self._lock = 1;
            _addToTimeline(self, child, start - child._delay, 1)._lock = 0;
          } else {
            prevStart = start;
          }

          if (start < 0 && child._ts) {
            max -= start;

            if (!parent && !self._dp || parent && parent.smoothChildTiming) {
              self._start += start / self._ts;
              self._time -= start;
              self._tTime -= start;
            }

            self.shiftChildren(-start, false, -1e999);
            prevStart = 0;
          }

          child._end > max && child._ts && (max = child._end);
          child = prev;
        }

        _setDuration(self, self === _globalTimeline && self._time > max ? self._time : max, 1, 1);

        self._dirty = 0;
      }

      return self._tDur;
    };

    Timeline.updateRoot = function updateRoot(time) {
      if (_globalTimeline._ts) {
        _lazySafeRender(_globalTimeline, _parentToChildTotalTime(time, _globalTimeline));

        _lastRenderedFrame = _ticker.frame;
      }

      if (_ticker.frame >= _nextGCFrame) {
        _nextGCFrame += _config.autoSleep || 120;
        var child = _globalTimeline._first;
        if (!child || !child._ts) if (_config.autoSleep && _ticker._listeners.length < 2) {
          while (child && !child._ts) {
            child = child._next;
          }

          child || _ticker.sleep();
        }
      }
    };

    return Timeline;
  }(Animation);

  _setDefaults(Timeline.prototype, {
    _lock: 0,
    _hasPause: 0,
    _forcing: 0
  });

  var _addComplexStringPropTween = function _addComplexStringPropTween(target, prop, start, end, setter, stringFilter, funcParam) {
    var pt = new PropTween(this._pt, target, prop, 0, 1, _renderComplexString, null, setter),
        index = 0,
        matchIndex = 0,
        result,
        startNums,
        color,
        endNum,
        chunk,
        startNum,
        hasRandom,
        a;
    pt.b = start;
    pt.e = end;
    start += "";
    end += "";

    if (hasRandom = ~end.indexOf("random(")) {
      end = _replaceRandom(end);
    }

    if (stringFilter) {
      a = [start, end];
      stringFilter(a, target, prop);
      start = a[0];
      end = a[1];
    }

    startNums = start.match(_complexStringNumExp) || [];

    while (result = _complexStringNumExp.exec(end)) {
      endNum = result[0];
      chunk = end.substring(index, result.index);

      if (color) {
        color = (color + 1) % 5;
      } else if (chunk.substr(-5) === "rgba(") {
        color = 1;
      }

      if (endNum !== startNums[matchIndex++]) {
        startNum = parseFloat(startNums[matchIndex - 1]) || 0;
        pt._pt = {
          _next: pt._pt,
          p: chunk || matchIndex === 1 ? chunk : ",",
          s: startNum,
          c: endNum.charAt(1) === "=" ? _parseRelative(startNum, endNum) - startNum : parseFloat(endNum) - startNum,
          m: color && color < 4 ? Math.round : 0
        };
        index = _complexStringNumExp.lastIndex;
      }
    }

    pt.c = index < end.length ? end.substring(index, end.length) : "";
    pt.fp = funcParam;

    if (_relExp.test(end) || hasRandom) {
      pt.e = 0;
    }

    this._pt = pt;
    return pt;
  },
      _addPropTween = function _addPropTween(target, prop, start, end, index, targets, modifier, stringFilter, funcParam) {
    _isFunction(end) && (end = end(index || 0, target, targets));
    var currentValue = target[prop],
        parsedStart = start !== "get" ? start : !_isFunction(currentValue) ? currentValue : funcParam ? target[prop.indexOf("set") || !_isFunction(target["get" + prop.substr(3)]) ? prop : "get" + prop.substr(3)](funcParam) : target[prop](),
        setter = !_isFunction(currentValue) ? _setterPlain : funcParam ? _setterFuncWithParam : _setterFunc,
        pt;

    if (_isString(end)) {
      if (~end.indexOf("random(")) {
        end = _replaceRandom(end);
      }

      if (end.charAt(1) === "=") {
        pt = _parseRelative(parsedStart, end) + (getUnit(parsedStart) || 0);

        if (pt || pt === 0) {
          end = pt;
        }
      }
    }

    if (parsedStart !== end || _forceAllPropTweens) {
      if (!isNaN(parsedStart * end) && end !== "") {
        pt = new PropTween(this._pt, target, prop, +parsedStart || 0, end - (parsedStart || 0), typeof currentValue === "boolean" ? _renderBoolean : _renderPlain, 0, setter);
        funcParam && (pt.fp = funcParam);
        modifier && pt.modifier(modifier, this, target);
        return this._pt = pt;
      }

      !currentValue && !(prop in target) && _missingPlugin(prop, end);
      return _addComplexStringPropTween.call(this, target, prop, parsedStart, end, setter, stringFilter || _config.stringFilter, funcParam);
    }
  },
      _processVars = function _processVars(vars, index, target, targets, tween) {
    _isFunction(vars) && (vars = _parseFuncOrString(vars, tween, index, target, targets));

    if (!_isObject(vars) || vars.style && vars.nodeType || _isArray(vars) || _isTypedArray(vars)) {
      return _isString(vars) ? _parseFuncOrString(vars, tween, index, target, targets) : vars;
    }

    var copy = {},
        p;

    for (p in vars) {
      copy[p] = _parseFuncOrString(vars[p], tween, index, target, targets);
    }

    return copy;
  },
      _checkPlugin = function _checkPlugin(property, vars, tween, index, target, targets) {
    var plugin, pt, ptLookup, i;

    if (_plugins[property] && (plugin = new _plugins[property]()).init(target, plugin.rawVars ? vars[property] : _processVars(vars[property], index, target, targets, tween), tween, index, targets) !== false) {
      tween._pt = pt = new PropTween(tween._pt, target, property, 0, 1, plugin.render, plugin, 0, plugin.priority);

      if (tween !== _quickTween) {
        ptLookup = tween._ptLookup[tween._targets.indexOf(target)];
        i = plugin._props.length;

        while (i--) {
          ptLookup[plugin._props[i]] = pt;
        }
      }
    }

    return plugin;
  },
      _overwritingTween,
      _forceAllPropTweens,
      _initTween = function _initTween(tween, time) {
    var vars = tween.vars,
        ease = vars.ease,
        startAt = vars.startAt,
        immediateRender = vars.immediateRender,
        lazy = vars.lazy,
        onUpdate = vars.onUpdate,
        onUpdateParams = vars.onUpdateParams,
        callbackScope = vars.callbackScope,
        runBackwards = vars.runBackwards,
        yoyoEase = vars.yoyoEase,
        keyframes = vars.keyframes,
        autoRevert = vars.autoRevert,
        dur = tween._dur,
        prevStartAt = tween._startAt,
        targets = tween._targets,
        parent = tween.parent,
        fullTargets = parent && parent.data === "nested" ? parent.parent._targets : targets,
        autoOverwrite = tween._overwrite === "auto" && !_suppressOverwrites,
        tl = tween.timeline,
        cleanVars,
        i,
        p,
        pt,
        target,
        hasPriority,
        gsData,
        harness,
        plugin,
        ptLookup,
        index,
        harnessVars,
        overwritten;
    tl && (!keyframes || !ease) && (ease = "none");
    tween._ease = _parseEase(ease, _defaults.ease);
    tween._yEase = yoyoEase ? _invertEase(_parseEase(yoyoEase === true ? ease : yoyoEase, _defaults.ease)) : 0;

    if (yoyoEase && tween._yoyo && !tween._repeat) {
      yoyoEase = tween._yEase;
      tween._yEase = tween._ease;
      tween._ease = yoyoEase;
    }

    tween._from = !tl && !!vars.runBackwards;

    if (!tl || keyframes && !vars.stagger) {
      harness = targets[0] ? _getCache(targets[0]).harness : 0;
      harnessVars = harness && vars[harness.prop];
      cleanVars = _copyExcluding(vars, _reservedProps);

      if (prevStartAt) {
        _removeFromParent(prevStartAt.render(-1, true));

        prevStartAt._lazy = 0;
      }

      if (startAt) {
        _removeFromParent(tween._startAt = Tween.set(targets, _setDefaults({
          data: "isStart",
          overwrite: false,
          parent: parent,
          immediateRender: true,
          lazy: _isNotFalse(lazy),
          startAt: null,
          delay: 0,
          onUpdate: onUpdate,
          onUpdateParams: onUpdateParams,
          callbackScope: callbackScope,
          stagger: 0
        }, startAt)));

        time < 0 && !immediateRender && !autoRevert && tween._startAt.render(-1, true);

        if (immediateRender) {
          time > 0 && !autoRevert && (tween._startAt = 0);

          if (dur && time <= 0) {
            time && (tween._zTime = time);
            return;
          }
        } else if (autoRevert === false) {
          tween._startAt = 0;
        }
      } else if (runBackwards && dur) {
        if (prevStartAt) {
          !autoRevert && (tween._startAt = 0);
        } else {
          time && (immediateRender = false);
          p = _setDefaults({
            overwrite: false,
            data: "isFromStart",
            lazy: immediateRender && _isNotFalse(lazy),
            immediateRender: immediateRender,
            stagger: 0,
            parent: parent
          }, cleanVars);
          harnessVars && (p[harness.prop] = harnessVars);

          _removeFromParent(tween._startAt = Tween.set(targets, p));

          time < 0 && tween._startAt.render(-1, true);
          tween._zTime = time;

          if (!immediateRender) {
            _initTween(tween._startAt, _tinyNum);
          } else if (!time) {
            return;
          }
        }
      }

      tween._pt = tween._ptCache = 0;
      lazy = dur && _isNotFalse(lazy) || lazy && !dur;

      for (i = 0; i < targets.length; i++) {
        target = targets[i];
        gsData = target._gsap || _harness(targets)[i]._gsap;
        tween._ptLookup[i] = ptLookup = {};
        _lazyLookup[gsData.id] && _lazyTweens.length && _lazyRender();
        index = fullTargets === targets ? i : fullTargets.indexOf(target);

        if (harness && (plugin = new harness()).init(target, harnessVars || cleanVars, tween, index, fullTargets) !== false) {
          tween._pt = pt = new PropTween(tween._pt, target, plugin.name, 0, 1, plugin.render, plugin, 0, plugin.priority);

          plugin._props.forEach(function (name) {
            ptLookup[name] = pt;
          });

          plugin.priority && (hasPriority = 1);
        }

        if (!harness || harnessVars) {
          for (p in cleanVars) {
            if (_plugins[p] && (plugin = _checkPlugin(p, cleanVars, tween, index, target, fullTargets))) {
              plugin.priority && (hasPriority = 1);
            } else {
              ptLookup[p] = pt = _addPropTween.call(tween, target, p, "get", cleanVars[p], index, fullTargets, 0, vars.stringFilter);
            }
          }
        }

        tween._op && tween._op[i] && tween.kill(target, tween._op[i]);

        if (autoOverwrite && tween._pt) {
          _overwritingTween = tween;

          _globalTimeline.killTweensOf(target, ptLookup, tween.globalTime(time));

          overwritten = !tween.parent;
          _overwritingTween = 0;
        }

        tween._pt && lazy && (_lazyLookup[gsData.id] = 1);
      }

      hasPriority && _sortPropTweensByPriority(tween);
      tween._onInit && tween._onInit(tween);
    }

    tween._onUpdate = onUpdate;
    tween._initted = (!tween._op || tween._pt) && !overwritten;
    keyframes && time <= 0 && tl.render(_bigNum, true, true);
  },
      _updatePropTweens = function _updatePropTweens(tween, property, value, start, startIsRelative, ratio, time) {
    var ptCache = (tween._pt && tween._ptCache || (tween._ptCache = {}))[property],
        pt,
        lookup,
        i;

    if (!ptCache) {
      ptCache = tween._ptCache[property] = [];
      lookup = tween._ptLookup;
      i = tween._targets.length;

      while (i--) {
        pt = lookup[i][property];

        if (pt && pt.d && pt.d._pt) {
          pt = pt.d._pt;

          while (pt && pt.p !== property) {
            pt = pt._next;
          }
        }

        if (!pt) {
          _forceAllPropTweens = 1;
          tween.vars[property] = "+=0";

          _initTween(tween, time);

          _forceAllPropTweens = 0;
          return 1;
        }

        ptCache.push(pt);
      }
    }

    i = ptCache.length;

    while (i--) {
      pt = ptCache[i];
      pt.s = (start || start === 0) && !startIsRelative ? start : pt.s + (start || 0) + ratio * pt.c;
      pt.c = value - pt.s;
      pt.e && (pt.e = _round(value) + getUnit(pt.e));
      pt.b && (pt.b = pt.s + getUnit(pt.b));
    }
  },
      _addAliasesToVars = function _addAliasesToVars(targets, vars) {
    var harness = targets[0] ? _getCache(targets[0]).harness : 0,
        propertyAliases = harness && harness.aliases,
        copy,
        p,
        i,
        aliases;

    if (!propertyAliases) {
      return vars;
    }

    copy = _merge({}, vars);

    for (p in propertyAliases) {
      if (p in copy) {
        aliases = propertyAliases[p].split(",");
        i = aliases.length;

        while (i--) {
          copy[aliases[i]] = copy[p];
        }
      }
    }

    return copy;
  },
      _parseKeyframe = function _parseKeyframe(prop, obj, allProps, easeEach) {
    var ease = obj.ease || easeEach || "power1.inOut",
        p,
        a;

    if (_isArray(obj)) {
      a = allProps[prop] || (allProps[prop] = []);
      obj.forEach(function (value, i) {
        return a.push({
          t: i / (obj.length - 1) * 100,
          v: value,
          e: ease
        });
      });
    } else {
      for (p in obj) {
        a = allProps[p] || (allProps[p] = []);
        p === "ease" || a.push({
          t: parseFloat(prop),
          v: obj[p],
          e: ease
        });
      }
    }
  },
      _parseFuncOrString = function _parseFuncOrString(value, tween, i, target, targets) {
    return _isFunction(value) ? value.call(tween, i, target, targets) : _isString(value) && ~value.indexOf("random(") ? _replaceRandom(value) : value;
  },
      _staggerTweenProps = _callbackNames + "repeat,repeatDelay,yoyo,repeatRefresh,yoyoEase,autoRevert",
      _staggerPropsToSkip = {};

  _forEachName(_staggerTweenProps + ",id,stagger,delay,duration,paused,scrollTrigger", function (name) {
    return _staggerPropsToSkip[name] = 1;
  });

  var Tween = function (_Animation2) {
    _inheritsLoose(Tween, _Animation2);

    function Tween(targets, vars, position, skipInherit) {
      var _this3;

      if (typeof vars === "number") {
        position.duration = vars;
        vars = position;
        position = null;
      }

      _this3 = _Animation2.call(this, skipInherit ? vars : _inheritDefaults(vars)) || this;
      var _this3$vars = _this3.vars,
          duration = _this3$vars.duration,
          delay = _this3$vars.delay,
          immediateRender = _this3$vars.immediateRender,
          stagger = _this3$vars.stagger,
          overwrite = _this3$vars.overwrite,
          keyframes = _this3$vars.keyframes,
          defaults = _this3$vars.defaults,
          scrollTrigger = _this3$vars.scrollTrigger,
          yoyoEase = _this3$vars.yoyoEase,
          parent = vars.parent || _globalTimeline,
          parsedTargets = (_isArray(targets) || _isTypedArray(targets) ? _isNumber(targets[0]) : "length" in vars) ? [targets] : toArray(targets),
          tl,
          i,
          copy,
          l,
          p,
          curTarget,
          staggerFunc,
          staggerVarsToMerge;
      _this3._targets = parsedTargets.length ? _harness(parsedTargets) : _warn("GSAP target " + targets + " not found. https://greensock.com", !_config.nullTargetWarn) || [];
      _this3._ptLookup = [];
      _this3._overwrite = overwrite;

      if (keyframes || stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
        vars = _this3.vars;
        tl = _this3.timeline = new Timeline({
          data: "nested",
          defaults: defaults || {}
        });
        tl.kill();
        tl.parent = tl._dp = _assertThisInitialized(_this3);
        tl._start = 0;

        if (stagger || _isFuncOrString(duration) || _isFuncOrString(delay)) {
          l = parsedTargets.length;
          staggerFunc = stagger && distribute(stagger);

          if (_isObject(stagger)) {
            for (p in stagger) {
              if (~_staggerTweenProps.indexOf(p)) {
                staggerVarsToMerge || (staggerVarsToMerge = {});
                staggerVarsToMerge[p] = stagger[p];
              }
            }
          }

          for (i = 0; i < l; i++) {
            copy = _copyExcluding(vars, _staggerPropsToSkip);
            copy.stagger = 0;
            yoyoEase && (copy.yoyoEase = yoyoEase);
            staggerVarsToMerge && _merge(copy, staggerVarsToMerge);
            curTarget = parsedTargets[i];
            copy.duration = +_parseFuncOrString(duration, _assertThisInitialized(_this3), i, curTarget, parsedTargets);
            copy.delay = (+_parseFuncOrString(delay, _assertThisInitialized(_this3), i, curTarget, parsedTargets) || 0) - _this3._delay;

            if (!stagger && l === 1 && copy.delay) {
              _this3._delay = delay = copy.delay;
              _this3._start += delay;
              copy.delay = 0;
            }

            tl.to(curTarget, copy, staggerFunc ? staggerFunc(i, curTarget, parsedTargets) : 0);
            tl._ease = _easeMap.none;
          }

          tl.duration() ? duration = delay = 0 : _this3.timeline = 0;
        } else if (keyframes) {
          _inheritDefaults(_setDefaults(tl.vars.defaults, {
            ease: "none"
          }));

          tl._ease = _parseEase(keyframes.ease || vars.ease || "none");
          var time = 0,
              a,
              kf,
              v;

          if (_isArray(keyframes)) {
            keyframes.forEach(function (frame) {
              return tl.to(parsedTargets, frame, ">");
            });
          } else {
            copy = {};

            for (p in keyframes) {
              p === "ease" || p === "easeEach" || _parseKeyframe(p, keyframes[p], copy, keyframes.easeEach);
            }

            for (p in copy) {
              a = copy[p].sort(function (a, b) {
                return a.t - b.t;
              });
              time = 0;

              for (i = 0; i < a.length; i++) {
                kf = a[i];
                v = {
                  ease: kf.e,
                  duration: (kf.t - (i ? a[i - 1].t : 0)) / 100 * duration
                };
                v[p] = kf.v;
                tl.to(parsedTargets, v, time);
                time += v.duration;
              }
            }

            tl.duration() < duration && tl.to({}, {
              duration: duration - tl.duration()
            });
          }
        }

        duration || _this3.duration(duration = tl.duration());
      } else {
        _this3.timeline = 0;
      }

      if (overwrite === true && !_suppressOverwrites) {
        _overwritingTween = _assertThisInitialized(_this3);

        _globalTimeline.killTweensOf(parsedTargets);

        _overwritingTween = 0;
      }

      _addToTimeline(parent, _assertThisInitialized(_this3), position);

      vars.reversed && _this3.reverse();
      vars.paused && _this3.paused(true);

      if (immediateRender || !duration && !keyframes && _this3._start === _roundPrecise(parent._time) && _isNotFalse(immediateRender) && _hasNoPausedAncestors(_assertThisInitialized(_this3)) && parent.data !== "nested") {
        _this3._tTime = -_tinyNum;

        _this3.render(Math.max(0, -delay));
      }

      scrollTrigger && _scrollTrigger(_assertThisInitialized(_this3), scrollTrigger);
      return _this3;
    }

    var _proto3 = Tween.prototype;

    _proto3.render = function render(totalTime, suppressEvents, force) {
      var prevTime = this._time,
          tDur = this._tDur,
          dur = this._dur,
          tTime = totalTime > tDur - _tinyNum && totalTime >= 0 ? tDur : totalTime < _tinyNum ? 0 : totalTime,
          time,
          pt,
          iteration,
          cycleDuration,
          prevIteration,
          isYoyo,
          ratio,
          timeline,
          yoyoEase;

      if (!dur) {
        _renderZeroDurationTween(this, totalTime, suppressEvents, force);
      } else if (tTime !== this._tTime || !totalTime || force || !this._initted && this._tTime || this._startAt && this._zTime < 0 !== totalTime < 0) {
        time = tTime;
        timeline = this.timeline;

        if (this._repeat) {
          cycleDuration = dur + this._rDelay;

          if (this._repeat < -1 && totalTime < 0) {
            return this.totalTime(cycleDuration * 100 + totalTime, suppressEvents, force);
          }

          time = _roundPrecise(tTime % cycleDuration);

          if (tTime === tDur) {
            iteration = this._repeat;
            time = dur;
          } else {
            iteration = ~~(tTime / cycleDuration);

            if (iteration && iteration === tTime / cycleDuration) {
              time = dur;
              iteration--;
            }

            time > dur && (time = dur);
          }

          isYoyo = this._yoyo && iteration & 1;

          if (isYoyo) {
            yoyoEase = this._yEase;
            time = dur - time;
          }

          prevIteration = _animationCycle(this._tTime, cycleDuration);

          if (time === prevTime && !force && this._initted) {
            this._tTime = tTime;
            return this;
          }

          if (iteration !== prevIteration) {
            timeline && this._yEase && _propagateYoyoEase(timeline, isYoyo);

            if (this.vars.repeatRefresh && !isYoyo && !this._lock) {
              this._lock = force = 1;
              this.render(_roundPrecise(cycleDuration * iteration), true).invalidate()._lock = 0;
            }
          }
        }

        if (!this._initted) {
          if (_attemptInitTween(this, totalTime < 0 ? totalTime : time, force, suppressEvents)) {
            this._tTime = 0;
            return this;
          }

          if (prevTime !== this._time) {
            return this;
          }

          if (dur !== this._dur) {
            return this.render(totalTime, suppressEvents, force);
          }
        }

        this._tTime = tTime;
        this._time = time;

        if (!this._act && this._ts) {
          this._act = 1;
          this._lazy = 0;
        }

        this.ratio = ratio = (yoyoEase || this._ease)(time / dur);

        if (this._from) {
          this.ratio = ratio = 1 - ratio;
        }

        if (time && !prevTime && !suppressEvents) {
          _callback(this, "onStart");

          if (this._tTime !== tTime) {
            return this;
          }
        }

        pt = this._pt;

        while (pt) {
          pt.r(ratio, pt.d);
          pt = pt._next;
        }

        timeline && timeline.render(totalTime < 0 ? totalTime : !time && isYoyo ? -_tinyNum : timeline._dur * timeline._ease(time / this._dur), suppressEvents, force) || this._startAt && (this._zTime = totalTime);

        if (this._onUpdate && !suppressEvents) {
          totalTime < 0 && this._startAt && this._startAt.render(totalTime, true, force);

          _callback(this, "onUpdate");
        }

        this._repeat && iteration !== prevIteration && this.vars.onRepeat && !suppressEvents && this.parent && _callback(this, "onRepeat");

        if ((tTime === this._tDur || !tTime) && this._tTime === tTime) {
          totalTime < 0 && this._startAt && !this._onUpdate && this._startAt.render(totalTime, true, true);
          (totalTime || !dur) && (tTime === this._tDur && this._ts > 0 || !tTime && this._ts < 0) && _removeFromParent(this, 1);

          if (!suppressEvents && !(totalTime < 0 && !prevTime) && (tTime || prevTime)) {
            _callback(this, tTime === tDur ? "onComplete" : "onReverseComplete", true);

            this._prom && !(tTime < tDur && this.timeScale() > 0) && this._prom();
          }
        }
      }

      return this;
    };

    _proto3.targets = function targets() {
      return this._targets;
    };

    _proto3.invalidate = function invalidate() {
      this._pt = this._op = this._startAt = this._onUpdate = this._lazy = this.ratio = 0;
      this._ptLookup = [];
      this.timeline && this.timeline.invalidate();
      return _Animation2.prototype.invalidate.call(this);
    };

    _proto3.resetTo = function resetTo(property, value, start, startIsRelative) {
      _tickerActive || _ticker.wake();
      this._ts || this.play();
      var time = Math.min(this._dur, (this._dp._time - this._start) * this._ts),
          ratio;
      this._initted || _initTween(this, time);
      ratio = this._ease(time / this._dur);

      if (_updatePropTweens(this, property, value, start, startIsRelative, ratio, time)) {
        return this.resetTo(property, value, start, startIsRelative);
      }

      _alignPlayhead(this, 0);

      this.parent || _addLinkedListItem(this._dp, this, "_first", "_last", this._dp._sort ? "_start" : 0);
      return this.render(0);
    };

    _proto3.kill = function kill(targets, vars) {
      if (vars === void 0) {
        vars = "all";
      }

      if (!targets && (!vars || vars === "all")) {
        this._lazy = this._pt = 0;
        return this.parent ? _interrupt(this) : this;
      }

      if (this.timeline) {
        var tDur = this.timeline.totalDuration();
        this.timeline.killTweensOf(targets, vars, _overwritingTween && _overwritingTween.vars.overwrite !== true)._first || _interrupt(this);
        this.parent && tDur !== this.timeline.totalDuration() && _setDuration(this, this._dur * this.timeline._tDur / tDur, 0, 1);
        return this;
      }

      var parsedTargets = this._targets,
          killingTargets = targets ? toArray(targets) : parsedTargets,
          propTweenLookup = this._ptLookup,
          firstPT = this._pt,
          overwrittenProps,
          curLookup,
          curOverwriteProps,
          props,
          p,
          pt,
          i;

      if ((!vars || vars === "all") && _arraysMatch(parsedTargets, killingTargets)) {
        vars === "all" && (this._pt = 0);
        return _interrupt(this);
      }

      overwrittenProps = this._op = this._op || [];

      if (vars !== "all") {
        if (_isString(vars)) {
          p = {};

          _forEachName(vars, function (name) {
            return p[name] = 1;
          });

          vars = p;
        }

        vars = _addAliasesToVars(parsedTargets, vars);
      }

      i = parsedTargets.length;

      while (i--) {
        if (~killingTargets.indexOf(parsedTargets[i])) {
          curLookup = propTweenLookup[i];

          if (vars === "all") {
            overwrittenProps[i] = vars;
            props = curLookup;
            curOverwriteProps = {};
          } else {
            curOverwriteProps = overwrittenProps[i] = overwrittenProps[i] || {};
            props = vars;
          }

          for (p in props) {
            pt = curLookup && curLookup[p];

            if (pt) {
              if (!("kill" in pt.d) || pt.d.kill(p) === true) {
                _removeLinkedListItem(this, pt, "_pt");
              }

              delete curLookup[p];
            }

            if (curOverwriteProps !== "all") {
              curOverwriteProps[p] = 1;
            }
          }
        }
      }

      this._initted && !this._pt && firstPT && _interrupt(this);
      return this;
    };

    Tween.to = function to(targets, vars) {
      return new Tween(targets, vars, arguments[2]);
    };

    Tween.from = function from(targets, vars) {
      return _createTweenType(1, arguments);
    };

    Tween.delayedCall = function delayedCall(delay, callback, params, scope) {
      return new Tween(callback, 0, {
        immediateRender: false,
        lazy: false,
        overwrite: false,
        delay: delay,
        onComplete: callback,
        onReverseComplete: callback,
        onCompleteParams: params,
        onReverseCompleteParams: params,
        callbackScope: scope
      });
    };

    Tween.fromTo = function fromTo(targets, fromVars, toVars) {
      return _createTweenType(2, arguments);
    };

    Tween.set = function set(targets, vars) {
      vars.duration = 0;
      vars.repeatDelay || (vars.repeat = 0);
      return new Tween(targets, vars);
    };

    Tween.killTweensOf = function killTweensOf(targets, props, onlyActive) {
      return _globalTimeline.killTweensOf(targets, props, onlyActive);
    };

    return Tween;
  }(Animation);

  _setDefaults(Tween.prototype, {
    _targets: [],
    _lazy: 0,
    _startAt: 0,
    _op: 0,
    _onInit: 0
  });

  _forEachName("staggerTo,staggerFrom,staggerFromTo", function (name) {
    Tween[name] = function () {
      var tl = new Timeline(),
          params = _slice.call(arguments, 0);

      params.splice(name === "staggerFromTo" ? 5 : 4, 0, 0);
      return tl[name].apply(tl, params);
    };
  });

  var _setterPlain = function _setterPlain(target, property, value) {
    return target[property] = value;
  },
      _setterFunc = function _setterFunc(target, property, value) {
    return target[property](value);
  },
      _setterFuncWithParam = function _setterFuncWithParam(target, property, value, data) {
    return target[property](data.fp, value);
  },
      _setterAttribute = function _setterAttribute(target, property, value) {
    return target.setAttribute(property, value);
  },
      _getSetter = function _getSetter(target, property) {
    return _isFunction(target[property]) ? _setterFunc : _isUndefined(target[property]) && target.setAttribute ? _setterAttribute : _setterPlain;
  },
      _renderPlain = function _renderPlain(ratio, data) {
    return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 1000000) / 1000000, data);
  },
      _renderBoolean = function _renderBoolean(ratio, data) {
    return data.set(data.t, data.p, !!(data.s + data.c * ratio), data);
  },
      _renderComplexString = function _renderComplexString(ratio, data) {
    var pt = data._pt,
        s = "";

    if (!ratio && data.b) {
      s = data.b;
    } else if (ratio === 1 && data.e) {
      s = data.e;
    } else {
      while (pt) {
        s = pt.p + (pt.m ? pt.m(pt.s + pt.c * ratio) : Math.round((pt.s + pt.c * ratio) * 10000) / 10000) + s;
        pt = pt._next;
      }

      s += data.c;
    }

    data.set(data.t, data.p, s, data);
  },
      _renderPropTweens = function _renderPropTweens(ratio, data) {
    var pt = data._pt;

    while (pt) {
      pt.r(ratio, pt.d);
      pt = pt._next;
    }
  },
      _addPluginModifier = function _addPluginModifier(modifier, tween, target, property) {
    var pt = this._pt,
        next;

    while (pt) {
      next = pt._next;
      pt.p === property && pt.modifier(modifier, tween, target);
      pt = next;
    }
  },
      _killPropTweensOf = function _killPropTweensOf(property) {
    var pt = this._pt,
        hasNonDependentRemaining,
        next;

    while (pt) {
      next = pt._next;

      if (pt.p === property && !pt.op || pt.op === property) {
        _removeLinkedListItem(this, pt, "_pt");
      } else if (!pt.dep) {
        hasNonDependentRemaining = 1;
      }

      pt = next;
    }

    return !hasNonDependentRemaining;
  },
      _setterWithModifier = function _setterWithModifier(target, property, value, data) {
    data.mSet(target, property, data.m.call(data.tween, value, data.mt), data);
  },
      _sortPropTweensByPriority = function _sortPropTweensByPriority(parent) {
    var pt = parent._pt,
        next,
        pt2,
        first,
        last;

    while (pt) {
      next = pt._next;
      pt2 = first;

      while (pt2 && pt2.pr > pt.pr) {
        pt2 = pt2._next;
      }

      if (pt._prev = pt2 ? pt2._prev : last) {
        pt._prev._next = pt;
      } else {
        first = pt;
      }

      if (pt._next = pt2) {
        pt2._prev = pt;
      } else {
        last = pt;
      }

      pt = next;
    }

    parent._pt = first;
  };

  var PropTween = function () {
    function PropTween(next, target, prop, start, change, renderer, data, setter, priority) {
      this.t = target;
      this.s = start;
      this.c = change;
      this.p = prop;
      this.r = renderer || _renderPlain;
      this.d = data || this;
      this.set = setter || _setterPlain;
      this.pr = priority || 0;
      this._next = next;

      if (next) {
        next._prev = this;
      }
    }

    var _proto4 = PropTween.prototype;

    _proto4.modifier = function modifier(func, tween, target) {
      this.mSet = this.mSet || this.set;
      this.set = _setterWithModifier;
      this.m = func;
      this.mt = target;
      this.tween = tween;
    };

    return PropTween;
  }();

  _forEachName(_callbackNames + "parent,duration,ease,delay,overwrite,runBackwards,startAt,yoyo,immediateRender,repeat,repeatDelay,data,paused,reversed,lazy,callbackScope,stringFilter,id,yoyoEase,stagger,inherit,repeatRefresh,keyframes,autoRevert,scrollTrigger", function (name) {
    return _reservedProps[name] = 1;
  });

  _globals.TweenMax = _globals.TweenLite = Tween;
  _globals.TimelineLite = _globals.TimelineMax = Timeline;
  _globalTimeline = new Timeline({
    sortChildren: false,
    defaults: _defaults,
    autoRemoveChildren: true,
    id: "root",
    smoothChildTiming: true
  });
  _config.stringFilter = _colorStringFilter;
  var _gsap = {
    registerPlugin: function registerPlugin() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      args.forEach(function (config) {
        return _createPlugin(config);
      });
    },
    timeline: function timeline(vars) {
      return new Timeline(vars);
    },
    getTweensOf: function getTweensOf(targets, onlyActive) {
      return _globalTimeline.getTweensOf(targets, onlyActive);
    },
    getProperty: function getProperty(target, property, unit, uncache) {
      _isString(target) && (target = toArray(target)[0]);

      var getter = _getCache(target || {}).get,
          format = unit ? _passThrough : _numericIfPossible;

      unit === "native" && (unit = "");
      return !target ? target : !property ? function (property, unit, uncache) {
        return format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
      } : format((_plugins[property] && _plugins[property].get || getter)(target, property, unit, uncache));
    },
    quickSetter: function quickSetter(target, property, unit) {
      target = toArray(target);

      if (target.length > 1) {
        var setters = target.map(function (t) {
          return gsap.quickSetter(t, property, unit);
        }),
            l = setters.length;
        return function (value) {
          var i = l;

          while (i--) {
            setters[i](value);
          }
        };
      }

      target = target[0] || {};

      var Plugin = _plugins[property],
          cache = _getCache(target),
          p = cache.harness && (cache.harness.aliases || {})[property] || property,
          setter = Plugin ? function (value) {
        var p = new Plugin();
        _quickTween._pt = 0;
        p.init(target, unit ? value + unit : value, _quickTween, 0, [target]);
        p.render(1, p);
        _quickTween._pt && _renderPropTweens(1, _quickTween);
      } : cache.set(target, p);

      return Plugin ? setter : function (value) {
        return setter(target, p, unit ? value + unit : value, cache, 1);
      };
    },
    quickTo: function quickTo(target, property, vars) {
      var _merge2;

      var tween = gsap.to(target, _merge((_merge2 = {}, _merge2[property] = "+=0.1", _merge2.paused = true, _merge2), vars || {})),
          func = function func(value, start, startIsRelative) {
        return tween.resetTo(property, value, start, startIsRelative);
      };

      func.tween = tween;
      return func;
    },
    isTweening: function isTweening(targets) {
      return _globalTimeline.getTweensOf(targets, true).length > 0;
    },
    defaults: function defaults(value) {
      value && value.ease && (value.ease = _parseEase(value.ease, _defaults.ease));
      return _mergeDeep(_defaults, value || {});
    },
    config: function config(value) {
      return _mergeDeep(_config, value || {});
    },
    registerEffect: function registerEffect(_ref3) {
      var name = _ref3.name,
          effect = _ref3.effect,
          plugins = _ref3.plugins,
          defaults = _ref3.defaults,
          extendTimeline = _ref3.extendTimeline;
      (plugins || "").split(",").forEach(function (pluginName) {
        return pluginName && !_plugins[pluginName] && !_globals[pluginName] && _warn(name + " effect requires " + pluginName + " plugin.");
      });

      _effects[name] = function (targets, vars, tl) {
        return effect(toArray(targets), _setDefaults(vars || {}, defaults), tl);
      };

      if (extendTimeline) {
        Timeline.prototype[name] = function (targets, vars, position) {
          return this.add(_effects[name](targets, _isObject(vars) ? vars : (position = vars) && {}, this), position);
        };
      }
    },
    registerEase: function registerEase(name, ease) {
      _easeMap[name] = _parseEase(ease);
    },
    parseEase: function parseEase(ease, defaultEase) {
      return arguments.length ? _parseEase(ease, defaultEase) : _easeMap;
    },
    getById: function getById(id) {
      return _globalTimeline.getById(id);
    },
    exportRoot: function exportRoot(vars, includeDelayedCalls) {
      if (vars === void 0) {
        vars = {};
      }

      var tl = new Timeline(vars),
          child,
          next;
      tl.smoothChildTiming = _isNotFalse(vars.smoothChildTiming);

      _globalTimeline.remove(tl);

      tl._dp = 0;
      tl._time = tl._tTime = _globalTimeline._time;
      child = _globalTimeline._first;

      while (child) {
        next = child._next;

        if (includeDelayedCalls || !(!child._dur && child instanceof Tween && child.vars.onComplete === child._targets[0])) {
          _addToTimeline(tl, child, child._start - child._delay);
        }

        child = next;
      }

      _addToTimeline(_globalTimeline, tl, 0);

      return tl;
    },
    utils: {
      wrap: wrap,
      wrapYoyo: wrapYoyo,
      distribute: distribute,
      random: random,
      snap: snap,
      normalize: normalize,
      getUnit: getUnit,
      clamp: clamp,
      splitColor: splitColor,
      toArray: toArray,
      selector: selector,
      mapRange: mapRange,
      pipe: pipe,
      unitize: unitize,
      interpolate: interpolate,
      shuffle: shuffle
    },
    install: _install,
    effects: _effects,
    ticker: _ticker,
    updateRoot: Timeline.updateRoot,
    plugins: _plugins,
    globalTimeline: _globalTimeline,
    core: {
      PropTween: PropTween,
      globals: _addGlobal,
      Tween: Tween,
      Timeline: Timeline,
      Animation: Animation,
      getCache: _getCache,
      _removeLinkedListItem: _removeLinkedListItem,
      suppressOverwrites: function suppressOverwrites(value) {
        return _suppressOverwrites = value;
      }
    }
  };

  _forEachName("to,from,fromTo,delayedCall,set,killTweensOf", function (name) {
    return _gsap[name] = Tween[name];
  });

  _ticker.add(Timeline.updateRoot);

  _quickTween = _gsap.to({}, {
    duration: 0
  });

  var _getPluginPropTween = function _getPluginPropTween(plugin, prop) {
    var pt = plugin._pt;

    while (pt && pt.p !== prop && pt.op !== prop && pt.fp !== prop) {
      pt = pt._next;
    }

    return pt;
  },
      _addModifiers = function _addModifiers(tween, modifiers) {
    var targets = tween._targets,
        p,
        i,
        pt;

    for (p in modifiers) {
      i = targets.length;

      while (i--) {
        pt = tween._ptLookup[i][p];

        if (pt && (pt = pt.d)) {
          if (pt._pt) {
            pt = _getPluginPropTween(pt, p);
          }

          pt && pt.modifier && pt.modifier(modifiers[p], tween, targets[i], p);
        }
      }
    }
  },
      _buildModifierPlugin = function _buildModifierPlugin(name, modifier) {
    return {
      name: name,
      rawVars: 1,
      init: function init(target, vars, tween) {
        tween._onInit = function (tween) {
          var temp, p;

          if (_isString(vars)) {
            temp = {};

            _forEachName(vars, function (name) {
              return temp[name] = 1;
            });

            vars = temp;
          }

          if (modifier) {
            temp = {};

            for (p in vars) {
              temp[p] = modifier(vars[p]);
            }

            vars = temp;
          }

          _addModifiers(tween, vars);
        };
      }
    };
  };

  var gsap = _gsap.registerPlugin({
    name: "attr",
    init: function init(target, vars, tween, index, targets) {
      var p, pt;

      for (p in vars) {
        pt = this.add(target, "setAttribute", (target.getAttribute(p) || 0) + "", vars[p], index, targets, 0, 0, p);
        pt && (pt.op = p);

        this._props.push(p);
      }
    }
  }, {
    name: "endArray",
    init: function init(target, value) {
      var i = value.length;

      while (i--) {
        this.add(target, i, target[i] || 0, value[i]);
      }
    }
  }, _buildModifierPlugin("roundProps", _roundModifier), _buildModifierPlugin("modifiers"), _buildModifierPlugin("snap", snap)) || _gsap;
  Tween.version = Timeline.version = gsap.version = "3.10.4";
  _coreReady = 1;
  _windowExists() && _wake();
  var Power0 = _easeMap.Power0,
      Power1 = _easeMap.Power1,
      Power2 = _easeMap.Power2,
      Power3 = _easeMap.Power3,
      Power4 = _easeMap.Power4,
      Linear = _easeMap.Linear,
      Quad = _easeMap.Quad,
      Cubic = _easeMap.Cubic,
      Quart = _easeMap.Quart,
      Quint = _easeMap.Quint,
      Strong = _easeMap.Strong,
      Elastic = _easeMap.Elastic,
      Back = _easeMap.Back,
      SteppedEase = _easeMap.SteppedEase,
      Bounce = _easeMap.Bounce,
      Sine = _easeMap.Sine,
      Expo = _easeMap.Expo,
      Circ = _easeMap.Circ;

  var _win$1,
      _doc$1,
      _docElement,
      _pluginInitted,
      _tempDiv,
      _tempDivStyler,
      _recentSetterPlugin,
      _windowExists$1 = function _windowExists() {
    return typeof window !== "undefined";
  },
      _transformProps = {},
      _RAD2DEG = 180 / Math.PI,
      _DEG2RAD = Math.PI / 180,
      _atan2 = Math.atan2,
      _bigNum$1 = 1e8,
      _capsExp = /([A-Z])/g,
      _horizontalExp = /(left|right|width|margin|padding|x)/i,
      _complexExp = /[\s,\(]\S/,
      _propertyAliases = {
    autoAlpha: "opacity,visibility",
    scale: "scaleX,scaleY",
    alpha: "opacity"
  },
      _renderCSSProp = function _renderCSSProp(ratio, data) {
    return data.set(data.t, data.p, Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
  },
      _renderPropWithEnd = function _renderPropWithEnd(ratio, data) {
    return data.set(data.t, data.p, ratio === 1 ? data.e : Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u, data);
  },
      _renderCSSPropWithBeginning = function _renderCSSPropWithBeginning(ratio, data) {
    return data.set(data.t, data.p, ratio ? Math.round((data.s + data.c * ratio) * 10000) / 10000 + data.u : data.b, data);
  },
      _renderRoundedCSSProp = function _renderRoundedCSSProp(ratio, data) {
    var value = data.s + data.c * ratio;
    data.set(data.t, data.p, ~~(value + (value < 0 ? -.5 : .5)) + data.u, data);
  },
      _renderNonTweeningValue = function _renderNonTweeningValue(ratio, data) {
    return data.set(data.t, data.p, ratio ? data.e : data.b, data);
  },
      _renderNonTweeningValueOnlyAtEnd = function _renderNonTweeningValueOnlyAtEnd(ratio, data) {
    return data.set(data.t, data.p, ratio !== 1 ? data.b : data.e, data);
  },
      _setterCSSStyle = function _setterCSSStyle(target, property, value) {
    return target.style[property] = value;
  },
      _setterCSSProp = function _setterCSSProp(target, property, value) {
    return target.style.setProperty(property, value);
  },
      _setterTransform = function _setterTransform(target, property, value) {
    return target._gsap[property] = value;
  },
      _setterScale = function _setterScale(target, property, value) {
    return target._gsap.scaleX = target._gsap.scaleY = value;
  },
      _setterScaleWithRender = function _setterScaleWithRender(target, property, value, data, ratio) {
    var cache = target._gsap;
    cache.scaleX = cache.scaleY = value;
    cache.renderTransform(ratio, cache);
  },
      _setterTransformWithRender = function _setterTransformWithRender(target, property, value, data, ratio) {
    var cache = target._gsap;
    cache[property] = value;
    cache.renderTransform(ratio, cache);
  },
      _transformProp = "transform",
      _transformOriginProp = _transformProp + "Origin",
      _supports3D,
      _createElement = function _createElement(type, ns) {
    var e = _doc$1.createElementNS ? _doc$1.createElementNS((ns || "http://www.w3.org/1999/xhtml").replace(/^https/, "http"), type) : _doc$1.createElement(type);
    return e.style ? e : _doc$1.createElement(type);
  },
      _getComputedProperty = function _getComputedProperty(target, property, skipPrefixFallback) {
    var cs = getComputedStyle(target);
    return cs[property] || cs.getPropertyValue(property.replace(_capsExp, "-$1").toLowerCase()) || cs.getPropertyValue(property) || !skipPrefixFallback && _getComputedProperty(target, _checkPropPrefix(property) || property, 1) || "";
  },
      _prefixes = "O,Moz,ms,Ms,Webkit".split(","),
      _checkPropPrefix = function _checkPropPrefix(property, element, preferPrefix) {
    var e = element || _tempDiv,
        s = e.style,
        i = 5;

    if (property in s && !preferPrefix) {
      return property;
    }

    property = property.charAt(0).toUpperCase() + property.substr(1);

    while (i-- && !(_prefixes[i] + property in s)) {}

    return i < 0 ? null : (i === 3 ? "ms" : i >= 0 ? _prefixes[i] : "") + property;
  },
      _initCore = function _initCore() {
    if (_windowExists$1() && window.document) {
      _win$1 = window;
      _doc$1 = _win$1.document;
      _docElement = _doc$1.documentElement;
      _tempDiv = _createElement("div") || {
        style: {}
      };
      _tempDivStyler = _createElement("div");
      _transformProp = _checkPropPrefix(_transformProp);
      _transformOriginProp = _transformProp + "Origin";
      _tempDiv.style.cssText = "border-width:0;line-height:0;position:absolute;padding:0";
      _supports3D = !!_checkPropPrefix("perspective");
      _pluginInitted = 1;
    }
  },
      _getBBoxHack = function _getBBoxHack(swapIfPossible) {
    var svg = _createElement("svg", this.ownerSVGElement && this.ownerSVGElement.getAttribute("xmlns") || "http://www.w3.org/2000/svg"),
        oldParent = this.parentNode,
        oldSibling = this.nextSibling,
        oldCSS = this.style.cssText,
        bbox;

    _docElement.appendChild(svg);

    svg.appendChild(this);
    this.style.display = "block";

    if (swapIfPossible) {
      try {
        bbox = this.getBBox();
        this._gsapBBox = this.getBBox;
        this.getBBox = _getBBoxHack;
      } catch (e) {}
    } else if (this._gsapBBox) {
      bbox = this._gsapBBox();
    }

    if (oldParent) {
      if (oldSibling) {
        oldParent.insertBefore(this, oldSibling);
      } else {
        oldParent.appendChild(this);
      }
    }

    _docElement.removeChild(svg);

    this.style.cssText = oldCSS;
    return bbox;
  },
      _getAttributeFallbacks = function _getAttributeFallbacks(target, attributesArray) {
    var i = attributesArray.length;

    while (i--) {
      if (target.hasAttribute(attributesArray[i])) {
        return target.getAttribute(attributesArray[i]);
      }
    }
  },
      _getBBox = function _getBBox(target) {
    var bounds;

    try {
      bounds = target.getBBox();
    } catch (error) {
      bounds = _getBBoxHack.call(target, true);
    }

    bounds && (bounds.width || bounds.height) || target.getBBox === _getBBoxHack || (bounds = _getBBoxHack.call(target, true));
    return bounds && !bounds.width && !bounds.x && !bounds.y ? {
      x: +_getAttributeFallbacks(target, ["x", "cx", "x1"]) || 0,
      y: +_getAttributeFallbacks(target, ["y", "cy", "y1"]) || 0,
      width: 0,
      height: 0
    } : bounds;
  },
      _isSVG = function _isSVG(e) {
    return !!(e.getCTM && (!e.parentNode || e.ownerSVGElement) && _getBBox(e));
  },
      _removeProperty = function _removeProperty(target, property) {
    if (property) {
      var style = target.style;

      if (property in _transformProps && property !== _transformOriginProp) {
        property = _transformProp;
      }

      if (style.removeProperty) {
        if (property.substr(0, 2) === "ms" || property.substr(0, 6) === "webkit") {
          property = "-" + property;
        }

        style.removeProperty(property.replace(_capsExp, "-$1").toLowerCase());
      } else {
        style.removeAttribute(property);
      }
    }
  },
      _addNonTweeningPT = function _addNonTweeningPT(plugin, target, property, beginning, end, onlySetAtEnd) {
    var pt = new PropTween(plugin._pt, target, property, 0, 1, onlySetAtEnd ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue);
    plugin._pt = pt;
    pt.b = beginning;
    pt.e = end;

    plugin._props.push(property);

    return pt;
  },
      _nonConvertibleUnits = {
    deg: 1,
    rad: 1,
    turn: 1
  },
      _convertToUnit = function _convertToUnit(target, property, value, unit) {
    var curValue = parseFloat(value) || 0,
        curUnit = (value + "").trim().substr((curValue + "").length) || "px",
        style = _tempDiv.style,
        horizontal = _horizontalExp.test(property),
        isRootSVG = target.tagName.toLowerCase() === "svg",
        measureProperty = (isRootSVG ? "client" : "offset") + (horizontal ? "Width" : "Height"),
        amount = 100,
        toPixels = unit === "px",
        toPercent = unit === "%",
        px,
        parent,
        cache,
        isSVG;

    if (unit === curUnit || !curValue || _nonConvertibleUnits[unit] || _nonConvertibleUnits[curUnit]) {
      return curValue;
    }

    curUnit !== "px" && !toPixels && (curValue = _convertToUnit(target, property, value, "px"));
    isSVG = target.getCTM && _isSVG(target);

    if ((toPercent || curUnit === "%") && (_transformProps[property] || ~property.indexOf("adius"))) {
      px = isSVG ? target.getBBox()[horizontal ? "width" : "height"] : target[measureProperty];
      return _round(toPercent ? curValue / px * amount : curValue / 100 * px);
    }

    style[horizontal ? "width" : "height"] = amount + (toPixels ? curUnit : unit);
    parent = ~property.indexOf("adius") || unit === "em" && target.appendChild && !isRootSVG ? target : target.parentNode;

    if (isSVG) {
      parent = (target.ownerSVGElement || {}).parentNode;
    }

    if (!parent || parent === _doc$1 || !parent.appendChild) {
      parent = _doc$1.body;
    }

    cache = parent._gsap;

    if (cache && toPercent && cache.width && horizontal && cache.time === _ticker.time) {
      return _round(curValue / cache.width * amount);
    } else {
      (toPercent || curUnit === "%") && (style.position = _getComputedProperty(target, "position"));
      parent === target && (style.position = "static");
      parent.appendChild(_tempDiv);
      px = _tempDiv[measureProperty];
      parent.removeChild(_tempDiv);
      style.position = "absolute";

      if (horizontal && toPercent) {
        cache = _getCache(parent);
        cache.time = _ticker.time;
        cache.width = parent[measureProperty];
      }
    }

    return _round(toPixels ? px * curValue / amount : px && curValue ? amount / px * curValue : 0);
  },
      _get = function _get(target, property, unit, uncache) {
    var value;
    _pluginInitted || _initCore();

    if (property in _propertyAliases && property !== "transform") {
      property = _propertyAliases[property];

      if (~property.indexOf(",")) {
        property = property.split(",")[0];
      }
    }

    if (_transformProps[property] && property !== "transform") {
      value = _parseTransform(target, uncache);
      value = property !== "transformOrigin" ? value[property] : value.svg ? value.origin : _firstTwoOnly(_getComputedProperty(target, _transformOriginProp)) + " " + value.zOrigin + "px";
    } else {
      value = target.style[property];

      if (!value || value === "auto" || uncache || ~(value + "").indexOf("calc(")) {
        value = _specialProps[property] && _specialProps[property](target, property, unit) || _getComputedProperty(target, property) || _getProperty(target, property) || (property === "opacity" ? 1 : 0);
      }
    }

    return unit && !~(value + "").trim().indexOf(" ") ? _convertToUnit(target, property, value, unit) + unit : value;
  },
      _tweenComplexCSSString = function _tweenComplexCSSString(target, prop, start, end) {
    if (!start || start === "none") {
      var p = _checkPropPrefix(prop, target, 1),
          s = p && _getComputedProperty(target, p, 1);

      if (s && s !== start) {
        prop = p;
        start = s;
      } else if (prop === "borderColor") {
        start = _getComputedProperty(target, "borderTopColor");
      }
    }

    var pt = new PropTween(this._pt, target.style, prop, 0, 1, _renderComplexString),
        index = 0,
        matchIndex = 0,
        a,
        result,
        startValues,
        startNum,
        color,
        startValue,
        endValue,
        endNum,
        chunk,
        endUnit,
        startUnit,
        endValues;
    pt.b = start;
    pt.e = end;
    start += "";
    end += "";

    if (end === "auto") {
      target.style[prop] = end;
      end = _getComputedProperty(target, prop) || end;
      target.style[prop] = start;
    }

    a = [start, end];

    _colorStringFilter(a);

    start = a[0];
    end = a[1];
    startValues = start.match(_numWithUnitExp) || [];
    endValues = end.match(_numWithUnitExp) || [];

    if (endValues.length) {
      while (result = _numWithUnitExp.exec(end)) {
        endValue = result[0];
        chunk = end.substring(index, result.index);

        if (color) {
          color = (color + 1) % 5;
        } else if (chunk.substr(-5) === "rgba(" || chunk.substr(-5) === "hsla(") {
          color = 1;
        }

        if (endValue !== (startValue = startValues[matchIndex++] || "")) {
          startNum = parseFloat(startValue) || 0;
          startUnit = startValue.substr((startNum + "").length);
          endValue.charAt(1) === "=" && (endValue = _parseRelative(startNum, endValue) + startUnit);
          endNum = parseFloat(endValue);
          endUnit = endValue.substr((endNum + "").length);
          index = _numWithUnitExp.lastIndex - endUnit.length;

          if (!endUnit) {
            endUnit = endUnit || _config.units[prop] || startUnit;

            if (index === end.length) {
              end += endUnit;
              pt.e += endUnit;
            }
          }

          if (startUnit !== endUnit) {
            startNum = _convertToUnit(target, prop, startValue, endUnit) || 0;
          }

          pt._pt = {
            _next: pt._pt,
            p: chunk || matchIndex === 1 ? chunk : ",",
            s: startNum,
            c: endNum - startNum,
            m: color && color < 4 || prop === "zIndex" ? Math.round : 0
          };
        }
      }

      pt.c = index < end.length ? end.substring(index, end.length) : "";
    } else {
      pt.r = prop === "display" && end === "none" ? _renderNonTweeningValueOnlyAtEnd : _renderNonTweeningValue;
    }

    _relExp.test(end) && (pt.e = 0);
    this._pt = pt;
    return pt;
  },
      _keywordToPercent = {
    top: "0%",
    bottom: "100%",
    left: "0%",
    right: "100%",
    center: "50%"
  },
      _convertKeywordsToPercentages = function _convertKeywordsToPercentages(value) {
    var split = value.split(" "),
        x = split[0],
        y = split[1] || "50%";

    if (x === "top" || x === "bottom" || y === "left" || y === "right") {
      value = x;
      x = y;
      y = value;
    }

    split[0] = _keywordToPercent[x] || x;
    split[1] = _keywordToPercent[y] || y;
    return split.join(" ");
  },
      _renderClearProps = function _renderClearProps(ratio, data) {
    if (data.tween && data.tween._time === data.tween._dur) {
      var target = data.t,
          style = target.style,
          props = data.u,
          cache = target._gsap,
          prop,
          clearTransforms,
          i;

      if (props === "all" || props === true) {
        style.cssText = "";
        clearTransforms = 1;
      } else {
        props = props.split(",");
        i = props.length;

        while (--i > -1) {
          prop = props[i];

          if (_transformProps[prop]) {
            clearTransforms = 1;
            prop = prop === "transformOrigin" ? _transformOriginProp : _transformProp;
          }

          _removeProperty(target, prop);
        }
      }

      if (clearTransforms) {
        _removeProperty(target, _transformProp);

        if (cache) {
          cache.svg && target.removeAttribute("transform");

          _parseTransform(target, 1);

          cache.uncache = 1;
        }
      }
    }
  },
      _specialProps = {
    clearProps: function clearProps(plugin, target, property, endValue, tween) {
      if (tween.data !== "isFromStart") {
        var pt = plugin._pt = new PropTween(plugin._pt, target, property, 0, 0, _renderClearProps);
        pt.u = endValue;
        pt.pr = -10;
        pt.tween = tween;

        plugin._props.push(property);

        return 1;
      }
    }
  },
      _identity2DMatrix = [1, 0, 0, 1, 0, 0],
      _rotationalProperties = {},
      _isNullTransform = function _isNullTransform(value) {
    return value === "matrix(1, 0, 0, 1, 0, 0)" || value === "none" || !value;
  },
      _getComputedTransformMatrixAsArray = function _getComputedTransformMatrixAsArray(target) {
    var matrixString = _getComputedProperty(target, _transformProp);

    return _isNullTransform(matrixString) ? _identity2DMatrix : matrixString.substr(7).match(_numExp).map(_round);
  },
      _getMatrix = function _getMatrix(target, force2D) {
    var cache = target._gsap || _getCache(target),
        style = target.style,
        matrix = _getComputedTransformMatrixAsArray(target),
        parent,
        nextSibling,
        temp,
        addedToDOM;

    if (cache.svg && target.getAttribute("transform")) {
      temp = target.transform.baseVal.consolidate().matrix;
      matrix = [temp.a, temp.b, temp.c, temp.d, temp.e, temp.f];
      return matrix.join(",") === "1,0,0,1,0,0" ? _identity2DMatrix : matrix;
    } else if (matrix === _identity2DMatrix && !target.offsetParent && target !== _docElement && !cache.svg) {
      temp = style.display;
      style.display = "block";
      parent = target.parentNode;

      if (!parent || !target.offsetParent) {
        addedToDOM = 1;
        nextSibling = target.nextSibling;

        _docElement.appendChild(target);
      }

      matrix = _getComputedTransformMatrixAsArray(target);
      temp ? style.display = temp : _removeProperty(target, "display");

      if (addedToDOM) {
        nextSibling ? parent.insertBefore(target, nextSibling) : parent ? parent.appendChild(target) : _docElement.removeChild(target);
      }
    }

    return force2D && matrix.length > 6 ? [matrix[0], matrix[1], matrix[4], matrix[5], matrix[12], matrix[13]] : matrix;
  },
      _applySVGOrigin = function _applySVGOrigin(target, origin, originIsAbsolute, smooth, matrixArray, pluginToAddPropTweensTo) {
    var cache = target._gsap,
        matrix = matrixArray || _getMatrix(target, true),
        xOriginOld = cache.xOrigin || 0,
        yOriginOld = cache.yOrigin || 0,
        xOffsetOld = cache.xOffset || 0,
        yOffsetOld = cache.yOffset || 0,
        a = matrix[0],
        b = matrix[1],
        c = matrix[2],
        d = matrix[3],
        tx = matrix[4],
        ty = matrix[5],
        originSplit = origin.split(" "),
        xOrigin = parseFloat(originSplit[0]) || 0,
        yOrigin = parseFloat(originSplit[1]) || 0,
        bounds,
        determinant,
        x,
        y;

    if (!originIsAbsolute) {
      bounds = _getBBox(target);
      xOrigin = bounds.x + (~originSplit[0].indexOf("%") ? xOrigin / 100 * bounds.width : xOrigin);
      yOrigin = bounds.y + (~(originSplit[1] || originSplit[0]).indexOf("%") ? yOrigin / 100 * bounds.height : yOrigin);
    } else if (matrix !== _identity2DMatrix && (determinant = a * d - b * c)) {
      x = xOrigin * (d / determinant) + yOrigin * (-c / determinant) + (c * ty - d * tx) / determinant;
      y = xOrigin * (-b / determinant) + yOrigin * (a / determinant) - (a * ty - b * tx) / determinant;
      xOrigin = x;
      yOrigin = y;
    }

    if (smooth || smooth !== false && cache.smooth) {
      tx = xOrigin - xOriginOld;
      ty = yOrigin - yOriginOld;
      cache.xOffset = xOffsetOld + (tx * a + ty * c) - tx;
      cache.yOffset = yOffsetOld + (tx * b + ty * d) - ty;
    } else {
      cache.xOffset = cache.yOffset = 0;
    }

    cache.xOrigin = xOrigin;
    cache.yOrigin = yOrigin;
    cache.smooth = !!smooth;
    cache.origin = origin;
    cache.originIsAbsolute = !!originIsAbsolute;
    target.style[_transformOriginProp] = "0px 0px";

    if (pluginToAddPropTweensTo) {
      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOrigin", xOriginOld, xOrigin);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOrigin", yOriginOld, yOrigin);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "xOffset", xOffsetOld, cache.xOffset);

      _addNonTweeningPT(pluginToAddPropTweensTo, cache, "yOffset", yOffsetOld, cache.yOffset);
    }

    target.setAttribute("data-svg-origin", xOrigin + " " + yOrigin);
  },
      _parseTransform = function _parseTransform(target, uncache) {
    var cache = target._gsap || new GSCache(target);

    if ("x" in cache && !uncache && !cache.uncache) {
      return cache;
    }

    var style = target.style,
        invertedScaleX = cache.scaleX < 0,
        px = "px",
        deg = "deg",
        origin = _getComputedProperty(target, _transformOriginProp) || "0",
        x,
        y,
        z,
        scaleX,
        scaleY,
        rotation,
        rotationX,
        rotationY,
        skewX,
        skewY,
        perspective,
        xOrigin,
        yOrigin,
        matrix,
        angle,
        cos,
        sin,
        a,
        b,
        c,
        d,
        a12,
        a22,
        t1,
        t2,
        t3,
        a13,
        a23,
        a33,
        a42,
        a43,
        a32;
    x = y = z = rotation = rotationX = rotationY = skewX = skewY = perspective = 0;
    scaleX = scaleY = 1;
    cache.svg = !!(target.getCTM && _isSVG(target));
    matrix = _getMatrix(target, cache.svg);

    if (cache.svg) {
      t1 = (!cache.uncache || origin === "0px 0px") && !uncache && target.getAttribute("data-svg-origin");

      _applySVGOrigin(target, t1 || origin, !!t1 || cache.originIsAbsolute, cache.smooth !== false, matrix);
    }

    xOrigin = cache.xOrigin || 0;
    yOrigin = cache.yOrigin || 0;

    if (matrix !== _identity2DMatrix) {
      a = matrix[0];
      b = matrix[1];
      c = matrix[2];
      d = matrix[3];
      x = a12 = matrix[4];
      y = a22 = matrix[5];

      if (matrix.length === 6) {
        scaleX = Math.sqrt(a * a + b * b);
        scaleY = Math.sqrt(d * d + c * c);
        rotation = a || b ? _atan2(b, a) * _RAD2DEG : 0;
        skewX = c || d ? _atan2(c, d) * _RAD2DEG + rotation : 0;
        skewX && (scaleY *= Math.abs(Math.cos(skewX * _DEG2RAD)));

        if (cache.svg) {
          x -= xOrigin - (xOrigin * a + yOrigin * c);
          y -= yOrigin - (xOrigin * b + yOrigin * d);
        }
      } else {
        a32 = matrix[6];
        a42 = matrix[7];
        a13 = matrix[8];
        a23 = matrix[9];
        a33 = matrix[10];
        a43 = matrix[11];
        x = matrix[12];
        y = matrix[13];
        z = matrix[14];
        angle = _atan2(a32, a33);
        rotationX = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a12 * cos + a13 * sin;
          t2 = a22 * cos + a23 * sin;
          t3 = a32 * cos + a33 * sin;
          a13 = a12 * -sin + a13 * cos;
          a23 = a22 * -sin + a23 * cos;
          a33 = a32 * -sin + a33 * cos;
          a43 = a42 * -sin + a43 * cos;
          a12 = t1;
          a22 = t2;
          a32 = t3;
        }

        angle = _atan2(-c, a33);
        rotationY = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(-angle);
          sin = Math.sin(-angle);
          t1 = a * cos - a13 * sin;
          t2 = b * cos - a23 * sin;
          t3 = c * cos - a33 * sin;
          a43 = d * sin + a43 * cos;
          a = t1;
          b = t2;
          c = t3;
        }

        angle = _atan2(b, a);
        rotation = angle * _RAD2DEG;

        if (angle) {
          cos = Math.cos(angle);
          sin = Math.sin(angle);
          t1 = a * cos + b * sin;
          t2 = a12 * cos + a22 * sin;
          b = b * cos - a * sin;
          a22 = a22 * cos - a12 * sin;
          a = t1;
          a12 = t2;
        }

        if (rotationX && Math.abs(rotationX) + Math.abs(rotation) > 359.9) {
          rotationX = rotation = 0;
          rotationY = 180 - rotationY;
        }

        scaleX = _round(Math.sqrt(a * a + b * b + c * c));
        scaleY = _round(Math.sqrt(a22 * a22 + a32 * a32));
        angle = _atan2(a12, a22);
        skewX = Math.abs(angle) > 0.0002 ? angle * _RAD2DEG : 0;
        perspective = a43 ? 1 / (a43 < 0 ? -a43 : a43) : 0;
      }

      if (cache.svg) {
        t1 = target.getAttribute("transform");
        cache.forceCSS = target.setAttribute("transform", "") || !_isNullTransform(_getComputedProperty(target, _transformProp));
        t1 && target.setAttribute("transform", t1);
      }
    }

    if (Math.abs(skewX) > 90 && Math.abs(skewX) < 270) {
      if (invertedScaleX) {
        scaleX *= -1;
        skewX += rotation <= 0 ? 180 : -180;
        rotation += rotation <= 0 ? 180 : -180;
      } else {
        scaleY *= -1;
        skewX += skewX <= 0 ? 180 : -180;
      }
    }

    uncache = uncache || cache.uncache;
    cache.x = x - ((cache.xPercent = x && (!uncache && cache.xPercent || (Math.round(target.offsetWidth / 2) === Math.round(-x) ? -50 : 0))) ? target.offsetWidth * cache.xPercent / 100 : 0) + px;
    cache.y = y - ((cache.yPercent = y && (!uncache && cache.yPercent || (Math.round(target.offsetHeight / 2) === Math.round(-y) ? -50 : 0))) ? target.offsetHeight * cache.yPercent / 100 : 0) + px;
    cache.z = z + px;
    cache.scaleX = _round(scaleX);
    cache.scaleY = _round(scaleY);
    cache.rotation = _round(rotation) + deg;
    cache.rotationX = _round(rotationX) + deg;
    cache.rotationY = _round(rotationY) + deg;
    cache.skewX = skewX + deg;
    cache.skewY = skewY + deg;
    cache.transformPerspective = perspective + px;

    if (cache.zOrigin = parseFloat(origin.split(" ")[2]) || 0) {
      style[_transformOriginProp] = _firstTwoOnly(origin);
    }

    cache.xOffset = cache.yOffset = 0;
    cache.force3D = _config.force3D;
    cache.renderTransform = cache.svg ? _renderSVGTransforms : _supports3D ? _renderCSSTransforms : _renderNon3DTransforms;
    cache.uncache = 0;
    return cache;
  },
      _firstTwoOnly = function _firstTwoOnly(value) {
    return (value = value.split(" "))[0] + " " + value[1];
  },
      _addPxTranslate = function _addPxTranslate(target, start, value) {
    var unit = getUnit(start);
    return _round(parseFloat(start) + parseFloat(_convertToUnit(target, "x", value + "px", unit))) + unit;
  },
      _renderNon3DTransforms = function _renderNon3DTransforms(ratio, cache) {
    cache.z = "0px";
    cache.rotationY = cache.rotationX = "0deg";
    cache.force3D = 0;

    _renderCSSTransforms(ratio, cache);
  },
      _zeroDeg = "0deg",
      _zeroPx = "0px",
      _endParenthesis = ") ",
      _renderCSSTransforms = function _renderCSSTransforms(ratio, cache) {
    var _ref = cache || this,
        xPercent = _ref.xPercent,
        yPercent = _ref.yPercent,
        x = _ref.x,
        y = _ref.y,
        z = _ref.z,
        rotation = _ref.rotation,
        rotationY = _ref.rotationY,
        rotationX = _ref.rotationX,
        skewX = _ref.skewX,
        skewY = _ref.skewY,
        scaleX = _ref.scaleX,
        scaleY = _ref.scaleY,
        transformPerspective = _ref.transformPerspective,
        force3D = _ref.force3D,
        target = _ref.target,
        zOrigin = _ref.zOrigin,
        transforms = "",
        use3D = force3D === "auto" && ratio && ratio !== 1 || force3D === true;

    if (zOrigin && (rotationX !== _zeroDeg || rotationY !== _zeroDeg)) {
      var angle = parseFloat(rotationY) * _DEG2RAD,
          a13 = Math.sin(angle),
          a33 = Math.cos(angle),
          cos;

      angle = parseFloat(rotationX) * _DEG2RAD;
      cos = Math.cos(angle);
      x = _addPxTranslate(target, x, a13 * cos * -zOrigin);
      y = _addPxTranslate(target, y, -Math.sin(angle) * -zOrigin);
      z = _addPxTranslate(target, z, a33 * cos * -zOrigin + zOrigin);
    }

    if (transformPerspective !== _zeroPx) {
      transforms += "perspective(" + transformPerspective + _endParenthesis;
    }

    if (xPercent || yPercent) {
      transforms += "translate(" + xPercent + "%, " + yPercent + "%) ";
    }

    if (use3D || x !== _zeroPx || y !== _zeroPx || z !== _zeroPx) {
      transforms += z !== _zeroPx || use3D ? "translate3d(" + x + ", " + y + ", " + z + ") " : "translate(" + x + ", " + y + _endParenthesis;
    }

    if (rotation !== _zeroDeg) {
      transforms += "rotate(" + rotation + _endParenthesis;
    }

    if (rotationY !== _zeroDeg) {
      transforms += "rotateY(" + rotationY + _endParenthesis;
    }

    if (rotationX !== _zeroDeg) {
      transforms += "rotateX(" + rotationX + _endParenthesis;
    }

    if (skewX !== _zeroDeg || skewY !== _zeroDeg) {
      transforms += "skew(" + skewX + ", " + skewY + _endParenthesis;
    }

    if (scaleX !== 1 || scaleY !== 1) {
      transforms += "scale(" + scaleX + ", " + scaleY + _endParenthesis;
    }

    target.style[_transformProp] = transforms || "translate(0, 0)";
  },
      _renderSVGTransforms = function _renderSVGTransforms(ratio, cache) {
    var _ref2 = cache || this,
        xPercent = _ref2.xPercent,
        yPercent = _ref2.yPercent,
        x = _ref2.x,
        y = _ref2.y,
        rotation = _ref2.rotation,
        skewX = _ref2.skewX,
        skewY = _ref2.skewY,
        scaleX = _ref2.scaleX,
        scaleY = _ref2.scaleY,
        target = _ref2.target,
        xOrigin = _ref2.xOrigin,
        yOrigin = _ref2.yOrigin,
        xOffset = _ref2.xOffset,
        yOffset = _ref2.yOffset,
        forceCSS = _ref2.forceCSS,
        tx = parseFloat(x),
        ty = parseFloat(y),
        a11,
        a21,
        a12,
        a22,
        temp;

    rotation = parseFloat(rotation);
    skewX = parseFloat(skewX);
    skewY = parseFloat(skewY);

    if (skewY) {
      skewY = parseFloat(skewY);
      skewX += skewY;
      rotation += skewY;
    }

    if (rotation || skewX) {
      rotation *= _DEG2RAD;
      skewX *= _DEG2RAD;
      a11 = Math.cos(rotation) * scaleX;
      a21 = Math.sin(rotation) * scaleX;
      a12 = Math.sin(rotation - skewX) * -scaleY;
      a22 = Math.cos(rotation - skewX) * scaleY;

      if (skewX) {
        skewY *= _DEG2RAD;
        temp = Math.tan(skewX - skewY);
        temp = Math.sqrt(1 + temp * temp);
        a12 *= temp;
        a22 *= temp;

        if (skewY) {
          temp = Math.tan(skewY);
          temp = Math.sqrt(1 + temp * temp);
          a11 *= temp;
          a21 *= temp;
        }
      }

      a11 = _round(a11);
      a21 = _round(a21);
      a12 = _round(a12);
      a22 = _round(a22);
    } else {
      a11 = scaleX;
      a22 = scaleY;
      a21 = a12 = 0;
    }

    if (tx && !~(x + "").indexOf("px") || ty && !~(y + "").indexOf("px")) {
      tx = _convertToUnit(target, "x", x, "px");
      ty = _convertToUnit(target, "y", y, "px");
    }

    if (xOrigin || yOrigin || xOffset || yOffset) {
      tx = _round(tx + xOrigin - (xOrigin * a11 + yOrigin * a12) + xOffset);
      ty = _round(ty + yOrigin - (xOrigin * a21 + yOrigin * a22) + yOffset);
    }

    if (xPercent || yPercent) {
      temp = target.getBBox();
      tx = _round(tx + xPercent / 100 * temp.width);
      ty = _round(ty + yPercent / 100 * temp.height);
    }

    temp = "matrix(" + a11 + "," + a21 + "," + a12 + "," + a22 + "," + tx + "," + ty + ")";
    target.setAttribute("transform", temp);
    forceCSS && (target.style[_transformProp] = temp);
  },
      _addRotationalPropTween = function _addRotationalPropTween(plugin, target, property, startNum, endValue) {
    var cap = 360,
        isString = _isString(endValue),
        endNum = parseFloat(endValue) * (isString && ~endValue.indexOf("rad") ? _RAD2DEG : 1),
        change = endNum - startNum,
        finalValue = startNum + change + "deg",
        direction,
        pt;

    if (isString) {
      direction = endValue.split("_")[1];

      if (direction === "short") {
        change %= cap;

        if (change !== change % (cap / 2)) {
          change += change < 0 ? cap : -cap;
        }
      }

      if (direction === "cw" && change < 0) {
        change = (change + cap * _bigNum$1) % cap - ~~(change / cap) * cap;
      } else if (direction === "ccw" && change > 0) {
        change = (change - cap * _bigNum$1) % cap - ~~(change / cap) * cap;
      }
    }

    plugin._pt = pt = new PropTween(plugin._pt, target, property, startNum, change, _renderPropWithEnd);
    pt.e = finalValue;
    pt.u = "deg";

    plugin._props.push(property);

    return pt;
  },
      _assign = function _assign(target, source) {
    for (var p in source) {
      target[p] = source[p];
    }

    return target;
  },
      _addRawTransformPTs = function _addRawTransformPTs(plugin, transforms, target) {
    var startCache = _assign({}, target._gsap),
        exclude = "perspective,force3D,transformOrigin,svgOrigin",
        style = target.style,
        endCache,
        p,
        startValue,
        endValue,
        startNum,
        endNum,
        startUnit,
        endUnit;

    if (startCache.svg) {
      startValue = target.getAttribute("transform");
      target.setAttribute("transform", "");
      style[_transformProp] = transforms;
      endCache = _parseTransform(target, 1);

      _removeProperty(target, _transformProp);

      target.setAttribute("transform", startValue);
    } else {
      startValue = getComputedStyle(target)[_transformProp];
      style[_transformProp] = transforms;
      endCache = _parseTransform(target, 1);
      style[_transformProp] = startValue;
    }

    for (p in _transformProps) {
      startValue = startCache[p];
      endValue = endCache[p];

      if (startValue !== endValue && exclude.indexOf(p) < 0) {
        startUnit = getUnit(startValue);
        endUnit = getUnit(endValue);
        startNum = startUnit !== endUnit ? _convertToUnit(target, p, startValue, endUnit) : parseFloat(startValue);
        endNum = parseFloat(endValue);
        plugin._pt = new PropTween(plugin._pt, endCache, p, startNum, endNum - startNum, _renderCSSProp);
        plugin._pt.u = endUnit || 0;

        plugin._props.push(p);
      }
    }

    _assign(endCache, startCache);
  };

  _forEachName("padding,margin,Width,Radius", function (name, index) {
    var t = "Top",
        r = "Right",
        b = "Bottom",
        l = "Left",
        props = (index < 3 ? [t, r, b, l] : [t + l, t + r, b + r, b + l]).map(function (side) {
      return index < 2 ? name + side : "border" + side + name;
    });

    _specialProps[index > 1 ? "border" + name : name] = function (plugin, target, property, endValue, tween) {
      var a, vars;

      if (arguments.length < 4) {
        a = props.map(function (prop) {
          return _get(plugin, prop, property);
        });
        vars = a.join(" ");
        return vars.split(a[0]).length === 5 ? a[0] : vars;
      }

      a = (endValue + "").split(" ");
      vars = {};
      props.forEach(function (prop, i) {
        return vars[prop] = a[i] = a[i] || a[(i - 1) / 2 | 0];
      });
      plugin.init(target, vars, tween);
    };
  });

  var CSSPlugin = {
    name: "css",
    register: _initCore,
    targetTest: function targetTest(target) {
      return target.style && target.nodeType;
    },
    init: function init(target, vars, tween, index, targets) {
      var props = this._props,
          style = target.style,
          startAt = tween.vars.startAt,
          startValue,
          endValue,
          endNum,
          startNum,
          type,
          specialProp,
          p,
          startUnit,
          endUnit,
          relative,
          isTransformRelated,
          transformPropTween,
          cache,
          smooth,
          hasPriority;
      _pluginInitted || _initCore();

      for (p in vars) {
        if (p === "autoRound") {
          continue;
        }

        endValue = vars[p];

        if (_plugins[p] && _checkPlugin(p, vars, tween, index, target, targets)) {
          continue;
        }

        type = typeof endValue;
        specialProp = _specialProps[p];

        if (type === "function") {
          endValue = endValue.call(tween, index, target, targets);
          type = typeof endValue;
        }

        if (type === "string" && ~endValue.indexOf("random(")) {
          endValue = _replaceRandom(endValue);
        }

        if (specialProp) {
          specialProp(this, target, p, endValue, tween) && (hasPriority = 1);
        } else if (p.substr(0, 2) === "--") {
          startValue = (getComputedStyle(target).getPropertyValue(p) + "").trim();
          endValue += "";
          _colorExp.lastIndex = 0;

          if (!_colorExp.test(startValue)) {
            startUnit = getUnit(startValue);
            endUnit = getUnit(endValue);
          }

          endUnit ? startUnit !== endUnit && (startValue = _convertToUnit(target, p, startValue, endUnit) + endUnit) : startUnit && (endValue += startUnit);
          this.add(style, "setProperty", startValue, endValue, index, targets, 0, 0, p);
          props.push(p);
        } else if (type !== "undefined") {
          if (startAt && p in startAt) {
            startValue = typeof startAt[p] === "function" ? startAt[p].call(tween, index, target, targets) : startAt[p];
            _isString(startValue) && ~startValue.indexOf("random(") && (startValue = _replaceRandom(startValue));
            getUnit(startValue + "") || (startValue += _config.units[p] || getUnit(_get(target, p)) || "");
            (startValue + "").charAt(1) === "=" && (startValue = _get(target, p));
          } else {
            startValue = _get(target, p);
          }

          startNum = parseFloat(startValue);
          relative = type === "string" && endValue.charAt(1) === "=" && endValue.substr(0, 2);
          relative && (endValue = endValue.substr(2));
          endNum = parseFloat(endValue);

          if (p in _propertyAliases) {
            if (p === "autoAlpha") {
              if (startNum === 1 && _get(target, "visibility") === "hidden" && endNum) {
                startNum = 0;
              }

              _addNonTweeningPT(this, style, "visibility", startNum ? "inherit" : "hidden", endNum ? "inherit" : "hidden", !endNum);
            }

            if (p !== "scale" && p !== "transform") {
              p = _propertyAliases[p];
              ~p.indexOf(",") && (p = p.split(",")[0]);
            }
          }

          isTransformRelated = p in _transformProps;

          if (isTransformRelated) {
            if (!transformPropTween) {
              cache = target._gsap;
              cache.renderTransform && !vars.parseTransform || _parseTransform(target, vars.parseTransform);
              smooth = vars.smoothOrigin !== false && cache.smooth;
              transformPropTween = this._pt = new PropTween(this._pt, style, _transformProp, 0, 1, cache.renderTransform, cache, 0, -1);
              transformPropTween.dep = 1;
            }

            if (p === "scale") {
              this._pt = new PropTween(this._pt, cache, "scaleY", cache.scaleY, (relative ? _parseRelative(cache.scaleY, relative + endNum) : endNum) - cache.scaleY || 0);
              props.push("scaleY", p);
              p += "X";
            } else if (p === "transformOrigin") {
              endValue = _convertKeywordsToPercentages(endValue);

              if (cache.svg) {
                _applySVGOrigin(target, endValue, 0, smooth, 0, this);
              } else {
                endUnit = parseFloat(endValue.split(" ")[2]) || 0;
                endUnit !== cache.zOrigin && _addNonTweeningPT(this, cache, "zOrigin", cache.zOrigin, endUnit);

                _addNonTweeningPT(this, style, p, _firstTwoOnly(startValue), _firstTwoOnly(endValue));
              }

              continue;
            } else if (p === "svgOrigin") {
              _applySVGOrigin(target, endValue, 1, smooth, 0, this);

              continue;
            } else if (p in _rotationalProperties) {
              _addRotationalPropTween(this, cache, p, startNum, relative ? _parseRelative(startNum, relative + endValue) : endValue);

              continue;
            } else if (p === "smoothOrigin") {
              _addNonTweeningPT(this, cache, "smooth", cache.smooth, endValue);

              continue;
            } else if (p === "force3D") {
              cache[p] = endValue;
              continue;
            } else if (p === "transform") {
              _addRawTransformPTs(this, endValue, target);

              continue;
            }
          } else if (!(p in style)) {
            p = _checkPropPrefix(p) || p;
          }

          if (isTransformRelated || (endNum || endNum === 0) && (startNum || startNum === 0) && !_complexExp.test(endValue) && p in style) {
            startUnit = (startValue + "").substr((startNum + "").length);
            endNum || (endNum = 0);
            endUnit = getUnit(endValue) || (p in _config.units ? _config.units[p] : startUnit);
            startUnit !== endUnit && (startNum = _convertToUnit(target, p, startValue, endUnit));
            this._pt = new PropTween(this._pt, isTransformRelated ? cache : style, p, startNum, (relative ? _parseRelative(startNum, relative + endNum) : endNum) - startNum, !isTransformRelated && (endUnit === "px" || p === "zIndex") && vars.autoRound !== false ? _renderRoundedCSSProp : _renderCSSProp);
            this._pt.u = endUnit || 0;

            if (startUnit !== endUnit && endUnit !== "%") {
              this._pt.b = startValue;
              this._pt.r = _renderCSSPropWithBeginning;
            }
          } else if (!(p in style)) {
            if (p in target) {
              this.add(target, p, startValue || target[p], relative ? relative + endValue : endValue, index, targets);
            } else {
              _missingPlugin(p, endValue);

              continue;
            }
          } else {
            _tweenComplexCSSString.call(this, target, p, startValue, relative ? relative + endValue : endValue);
          }

          props.push(p);
        }
      }

      hasPriority && _sortPropTweensByPriority(this);
    },
    get: _get,
    aliases: _propertyAliases,
    getSetter: function getSetter(target, property, plugin) {
      var p = _propertyAliases[property];
      p && p.indexOf(",") < 0 && (property = p);
      return property in _transformProps && property !== _transformOriginProp && (target._gsap.x || _get(target, "x")) ? plugin && _recentSetterPlugin === plugin ? property === "scale" ? _setterScale : _setterTransform : (_recentSetterPlugin = plugin || {}) && (property === "scale" ? _setterScaleWithRender : _setterTransformWithRender) : target.style && !_isUndefined(target.style[property]) ? _setterCSSStyle : ~property.indexOf("-") ? _setterCSSProp : _getSetter(target, property);
    },
    core: {
      _removeProperty: _removeProperty,
      _getMatrix: _getMatrix
    }
  };
  gsap.utils.checkPrefix = _checkPropPrefix;

  (function (positionAndScale, rotation, others, aliases) {
    var all = _forEachName(positionAndScale + "," + rotation + "," + others, function (name) {
      _transformProps[name] = 1;
    });

    _forEachName(rotation, function (name) {
      _config.units[name] = "deg";
      _rotationalProperties[name] = 1;
    });

    _propertyAliases[all[13]] = positionAndScale + "," + rotation;

    _forEachName(aliases, function (name) {
      var split = name.split(":");
      _propertyAliases[split[1]] = all[split[0]];
    });
  })("x,y,z,scale,scaleX,scaleY,xPercent,yPercent", "rotation,rotationX,rotationY,skewX,skewY", "transform,transformOrigin,svgOrigin,force3D,smoothOrigin,transformPerspective", "0:translateX,1:translateY,2:translateZ,8:rotate,8:rotationZ,8:rotateZ,9:rotateX,10:rotateY");

  _forEachName("x,y,z,top,right,bottom,left,width,height,fontSize,padding,margin,perspective", function (name) {
    _config.units[name] = "px";
  });

  gsap.registerPlugin(CSSPlugin);

  var gsapWithCSS = gsap.registerPlugin(CSSPlugin) || gsap,
      TweenMaxWithCSS = gsapWithCSS.core.Tween;

  exports.Back = Back;
  exports.Bounce = Bounce;
  exports.CSSPlugin = CSSPlugin;
  exports.Circ = Circ;
  exports.Cubic = Cubic;
  exports.Elastic = Elastic;
  exports.Expo = Expo;
  exports.Linear = Linear;
  exports.Power0 = Power0;
  exports.Power1 = Power1;
  exports.Power2 = Power2;
  exports.Power3 = Power3;
  exports.Power4 = Power4;
  exports.Quad = Quad;
  exports.Quart = Quart;
  exports.Quint = Quint;
  exports.Sine = Sine;
  exports.SteppedEase = SteppedEase;
  exports.Strong = Strong;
  exports.TimelineLite = Timeline;
  exports.TimelineMax = Timeline;
  exports.TweenLite = Tween;
  exports.TweenMax = TweenMaxWithCSS;
  exports.default = gsapWithCSS;
  exports.gsap = gsapWithCSS;

  if (typeof(window) === 'undefined' || window !== exports) {Object.defineProperty(exports, '__esModule', { value: true });} else {delete window.default;}

})));

/*!
 * dist/jquery.inputmask.min
 * https://github.com/RobinHerbots/Inputmask
 * Copyright (c) 2010 - 2022 Robin Herbots
 * Licensed under the MIT license
 * Version: 5.0.8-beta.25
 */
!function(e,t){if("object"==typeof exports&&"object"==typeof module)module.exports=t(require("jquery"));else if("function"==typeof define&&define.amd)define(["jquery"],t);else{var i="object"==typeof exports?t(require("jquery")):t(e.jQuery);for(var a in i)("object"==typeof exports?exports:e)[a]=i[a]}}(self||this,(function(e){return function(){"use strict";var t={3046:function(e,t,i){var a;Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0,i(3851),i(219),i(207),i(5296);var n=((a=i(2394))&&a.__esModule?a:{default:a}).default;t.default=n},8741:function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;var i=!("undefined"==typeof window||!window.document||!window.document.createElement);t.default=i},3976:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;var a,n=(a=i(5581))&&a.__esModule?a:{default:a};var r={_maxTestPos:500,placeholder:"_",optionalmarker:["[","]"],quantifiermarker:["{","}"],groupmarker:["(",")"],alternatormarker:"|",escapeChar:"\\",mask:null,regex:null,oncomplete:function(){},onincomplete:function(){},oncleared:function(){},repeat:0,greedy:!1,autoUnmask:!1,removeMaskOnSubmit:!1,clearMaskOnLostFocus:!0,insertMode:!0,insertModeVisual:!0,clearIncomplete:!1,alias:null,onKeyDown:function(){},onBeforeMask:null,onBeforePaste:function(e,t){return"function"==typeof t.onBeforeMask?t.onBeforeMask.call(this,e,t):e},onBeforeWrite:null,onUnMask:null,showMaskOnFocus:!0,showMaskOnHover:!0,onKeyValidation:function(){},skipOptionalPartCharacter:" ",numericInput:!1,rightAlign:!1,undoOnEscape:!0,radixPoint:"",_radixDance:!1,groupSeparator:"",keepStatic:null,positionCaretOnTab:!0,tabThrough:!1,supportsInputType:["text","tel","url","password","search"],ignorables:[n.default.BACKSPACE,n.default.TAB,n.default["PAUSE/BREAK"],n.default.ESCAPE,n.default.PAGE_UP,n.default.PAGE_DOWN,n.default.END,n.default.HOME,n.default.LEFT,n.default.UP,n.default.RIGHT,n.default.DOWN,n.default.INSERT,n.default.DELETE,93,112,113,114,115,116,117,118,119,120,121,122,123,0,229],isComplete:null,preValidation:null,postValidation:null,staticDefinitionSymbol:void 0,jitMasking:!1,nullable:!0,inputEventOnly:!1,noValuePatching:!1,positionCaretOnClick:"lvp",casing:null,inputmode:"text",importDataAttributes:!0,shiftPositions:!0,usePrototypeDefinitions:!0,validationEventTimeOut:3e3,substitutes:{}};t.default=r},7392:function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;t.default={9:{validator:"[0-9\uff10-\uff19]",definitionSymbol:"*"},a:{validator:"[A-Za-z\u0410-\u044f\u0401\u0451\xc0-\xff\xb5]",definitionSymbol:"*"},"*":{validator:"[0-9\uff10-\uff19A-Za-z\u0410-\u044f\u0401\u0451\xc0-\xff\xb5]"}}},3287:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;var a,n=(a=i(7957))&&a.__esModule?a:{default:a};if(void 0===n.default)throw"jQuery not loaded!";var r=n.default;t.default=r},9845:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.mobile=t.iphone=t.iemobile=t.ie=void 0;var a,n=(a=i(9380))&&a.__esModule?a:{default:a};var r=n.default.navigator&&n.default.navigator.userAgent||"",o=r.indexOf("MSIE ")>0||r.indexOf("Trident/")>0,s=n.default.navigator&&n.default.navigator.maxTouchPoints||"ontouchstart"in n.default,l=/iemobile/i.test(r),u=/iphone/i.test(r)&&!l;t.iphone=u,t.iemobile=l,t.mobile=s,t.ie=o},7184:function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e){return e.replace(i,"\\$1")};var i=new RegExp("(\\"+["/",".","*","+","?","|","(",")","[","]","{","}","\\","$","^"].join("|\\")+")","gim")},6030:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.EventHandlers=void 0;var a,n=i(8711),r=(a=i(5581))&&a.__esModule?a:{default:a},o=i(9845),s=i(7215),l=i(7760),u=i(4713);function c(e,t){var i="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(!i){if(Array.isArray(e)||(i=function(e,t){if(!e)return;if("string"==typeof e)return f(e,t);var i=Object.prototype.toString.call(e).slice(8,-1);"Object"===i&&e.constructor&&(i=e.constructor.name);if("Map"===i||"Set"===i)return Array.from(e);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return f(e,t)}(e))||t&&e&&"number"==typeof e.length){i&&(e=i);var a=0,n=function(){};return{s:n,n:function(){return a>=e.length?{done:!0}:{done:!1,value:e[a++]}},e:function(e){throw e},f:n}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var r,o=!0,s=!1;return{s:function(){i=i.call(e)},n:function(){var e=i.next();return o=e.done,e},e:function(e){s=!0,r=e},f:function(){try{o||null==i.return||i.return()}finally{if(s)throw r}}}}function f(e,t){(null==t||t>e.length)&&(t=e.length);for(var i=0,a=new Array(t);i<t;i++)a[i]=e[i];return a}var d={keydownEvent:function(e){var t=this.inputmask,i=t.opts,a=t.dependencyLib,c=t.maskset,f=this,d=a(f),p=e.keyCode,h=n.caret.call(t,f),v=i.onKeyDown.call(this,e,n.getBuffer.call(t),h,i);if(void 0!==v)return v;if(p===r.default.BACKSPACE||p===r.default.DELETE||o.iphone&&p===r.default.BACKSPACE_SAFARI||e.ctrlKey&&p===r.default.X&&!("oncut"in f))e.preventDefault(),s.handleRemove.call(t,f,p,h),(0,l.writeBuffer)(f,n.getBuffer.call(t,!0),c.p,e,f.inputmask._valueGet()!==n.getBuffer.call(t).join(""));else if(p===r.default.END||p===r.default.PAGE_DOWN){e.preventDefault();var m=n.seekNext.call(t,n.getLastValidPosition.call(t));n.caret.call(t,f,e.shiftKey?h.begin:m,m,!0)}else p===r.default.HOME&&!e.shiftKey||p===r.default.PAGE_UP?(e.preventDefault(),n.caret.call(t,f,0,e.shiftKey?h.begin:0,!0)):i.undoOnEscape&&p===r.default.ESCAPE&&!0!==e.altKey?((0,l.checkVal)(f,!0,!1,t.undoValue.split("")),d.trigger("click")):p!==r.default.INSERT||e.shiftKey||e.ctrlKey||void 0!==t.userOptions.insertMode?!0===i.tabThrough&&p===r.default.TAB?!0===e.shiftKey?(h.end=n.seekPrevious.call(t,h.end,!0),!0===u.getTest.call(t,h.end-1).match.static&&h.end--,h.begin=n.seekPrevious.call(t,h.end,!0),h.begin>=0&&h.end>0&&(e.preventDefault(),n.caret.call(t,f,h.begin,h.end))):(h.begin=n.seekNext.call(t,h.begin,!0),h.end=n.seekNext.call(t,h.begin,!0),h.end<c.maskLength&&h.end--,h.begin<=c.maskLength&&(e.preventDefault(),n.caret.call(t,f,h.begin,h.end))):e.shiftKey||i.insertModeVisual&&!1===i.insertMode&&(p===r.default.RIGHT?setTimeout((function(){var e=n.caret.call(t,f);n.caret.call(t,f,e.begin)}),0):p===r.default.LEFT&&setTimeout((function(){var e=n.translatePosition.call(t,f.inputmask.caretPos.begin);n.translatePosition.call(t,f.inputmask.caretPos.end);t.isRTL?n.caret.call(t,f,e+(e===c.maskLength?0:1)):n.caret.call(t,f,e-(0===e?0:1))}),0)):s.isSelection.call(t,h)?i.insertMode=!i.insertMode:(i.insertMode=!i.insertMode,n.caret.call(t,f,h.begin,h.begin));t.ignorable=i.ignorables.includes(p)},keypressEvent:function(e,t,i,a,o){var u=this.inputmask||this,c=u.opts,f=u.dependencyLib,d=u.maskset,p=u.el,h=f(p),v=e.keyCode;if(!(!0===t||e.ctrlKey&&e.altKey)&&(e.ctrlKey||e.metaKey||u.ignorable))return v===r.default.ENTER&&u.undoValue!==u._valueGet(!0)&&(u.undoValue=u._valueGet(!0),setTimeout((function(){h.trigger("change")}),0)),u.skipInputEvent=!0,!0;if(v){44!==v&&46!==v||3!==e.location||""===c.radixPoint||(v=c.radixPoint.charCodeAt(0));var m,g=t?{begin:o,end:o}:n.caret.call(u,p),k=String.fromCharCode(v);k=c.substitutes[k]||k,d.writeOutBuffer=!0;var y=s.isValid.call(u,g,k,a,void 0,void 0,void 0,t);if(!1!==y&&(n.resetMaskSet.call(u,!0),m=void 0!==y.caret?y.caret:n.seekNext.call(u,y.pos.begin?y.pos.begin:y.pos),d.p=m),m=c.numericInput&&void 0===y.caret?n.seekPrevious.call(u,m):m,!1!==i&&(setTimeout((function(){c.onKeyValidation.call(p,v,y)}),0),d.writeOutBuffer&&!1!==y)){var b=n.getBuffer.call(u);(0,l.writeBuffer)(p,b,m,e,!0!==t)}if(e.preventDefault(),t)return!1!==y&&(y.forwardPosition=m),y}},keyupEvent:function(e){var t=this.inputmask;t.isComposing&&(e.keyCode!==r.default.KEY_229&&e.keyCode!==r.default.ENTER||t.$el.trigger("input"))},pasteEvent:function(e){var t,i=this.inputmask,a=i.opts,r=i._valueGet(!0),o=n.caret.call(i,this);i.isRTL&&(t=o.end,o.end=n.translatePosition.call(i,o.begin),o.begin=n.translatePosition.call(i,t));var s=r.substr(0,o.begin),u=r.substr(o.end,r.length);if(s==(i.isRTL?n.getBufferTemplate.call(i).slice().reverse():n.getBufferTemplate.call(i)).slice(0,o.begin).join("")&&(s=""),u==(i.isRTL?n.getBufferTemplate.call(i).slice().reverse():n.getBufferTemplate.call(i)).slice(o.end).join("")&&(u=""),window.clipboardData&&window.clipboardData.getData)r=s+window.clipboardData.getData("Text")+u;else{if(!e.clipboardData||!e.clipboardData.getData)return!0;r=s+e.clipboardData.getData("text/plain")+u}var f=r;if(i.isRTL){f=f.split("");var d,p=c(n.getBufferTemplate.call(i));try{for(p.s();!(d=p.n()).done;){var h=d.value;f[0]===h&&f.shift()}}catch(e){p.e(e)}finally{p.f()}f=f.join("")}if("function"==typeof a.onBeforePaste){if(!1===(f=a.onBeforePaste.call(i,f,a)))return!1;f||(f=r)}(0,l.checkVal)(this,!0,!1,f.toString().split(""),e),e.preventDefault()},inputFallBackEvent:function(e){var t=this.inputmask,i=t.opts,a=t.dependencyLib;var s=this,c=s.inputmask._valueGet(!0),f=(t.isRTL?n.getBuffer.call(t).slice().reverse():n.getBuffer.call(t)).join(""),p=n.caret.call(t,s,void 0,void 0,!0);if(f!==c){c=function(e,i,a){if(o.iemobile){var r=i.replace(n.getBuffer.call(t).join(""),"");if(1===r.length){var s=i.split("");s.splice(a.begin,0,r),i=s.join("")}}return i}(0,c,p);var h=function(e,a,r){for(var o,s,l,c=e.substr(0,r.begin).split(""),f=e.substr(r.begin).split(""),d=a.substr(0,r.begin).split(""),p=a.substr(r.begin).split(""),h=c.length>=d.length?c.length:d.length,v=f.length>=p.length?f.length:p.length,m="",g=[],k="~";c.length<h;)c.push(k);for(;d.length<h;)d.push(k);for(;f.length<v;)f.unshift(k);for(;p.length<v;)p.unshift(k);var y=c.concat(f),b=d.concat(p);for(s=0,o=y.length;s<o;s++)switch(l=u.getPlaceholder.call(t,n.translatePosition.call(t,s)),m){case"insertText":b[s-1]===y[s]&&r.begin==y.length-1&&g.push(y[s]),s=o;break;case"insertReplacementText":case"deleteContentBackward":y[s]===k?r.end++:s=o;break;default:y[s]!==b[s]&&(y[s+1]!==k&&y[s+1]!==l&&void 0!==y[s+1]||(b[s]!==l||b[s+1]!==k)&&b[s]!==k?b[s+1]===k&&b[s]===y[s+1]?(m="insertText",g.push(y[s]),r.begin--,r.end--):y[s]!==l&&y[s]!==k&&(y[s+1]===k||b[s]!==y[s]&&b[s+1]===y[s+1])?(m="insertReplacementText",g.push(y[s]),r.begin--):y[s]===k?(m="deleteContentBackward",(n.isMask.call(t,n.translatePosition.call(t,s),!0)||b[s]===i.radixPoint)&&r.end++):s=o:(m="insertText",g.push(y[s]),r.begin--,r.end--))}return{action:m,data:g,caret:r}}(c,f,p);switch((s.inputmask.shadowRoot||s.ownerDocument).activeElement!==s&&s.focus(),(0,l.writeBuffer)(s,n.getBuffer.call(t)),n.caret.call(t,s,p.begin,p.end,!0),h.action){case"insertText":case"insertReplacementText":h.data.forEach((function(e,i){var n=new a.Event("keypress");n.keyCode=e.charCodeAt(0),t.ignorable=!1,d.keypressEvent.call(s,n)})),setTimeout((function(){t.$el.trigger("keyup")}),0);break;case"deleteContentBackward":var v=new a.Event("keydown");v.keyCode=r.default.BACKSPACE,d.keydownEvent.call(s,v);break;default:(0,l.applyInputValue)(s,c)}e.preventDefault()}},compositionendEvent:function(e){var t=this.inputmask;t.isComposing=!1,t.$el.trigger("input")},setValueEvent:function(e){var t=this.inputmask,i=this,a=e&&e.detail?e.detail[0]:arguments[1];void 0===a&&(a=i.inputmask._valueGet(!0)),(0,l.applyInputValue)(i,a),(e.detail&&void 0!==e.detail[1]||void 0!==arguments[2])&&n.caret.call(t,i,e.detail?e.detail[1]:arguments[2])},focusEvent:function(e){var t=this.inputmask,i=t.opts,a=this,r=a.inputmask._valueGet();i.showMaskOnFocus&&r!==n.getBuffer.call(t).join("")&&(0,l.writeBuffer)(a,n.getBuffer.call(t),n.seekNext.call(t,n.getLastValidPosition.call(t))),!0!==i.positionCaretOnTab||!1!==t.mouseEnter||s.isComplete.call(t,n.getBuffer.call(t))&&-1!==n.getLastValidPosition.call(t)||d.clickEvent.apply(a,[e,!0]),t.undoValue=t._valueGet(!0)},invalidEvent:function(e){this.inputmask.validationEvent=!0},mouseleaveEvent:function(){var e=this.inputmask,t=e.opts,i=this;e.mouseEnter=!1,t.clearMaskOnLostFocus&&(i.inputmask.shadowRoot||i.ownerDocument).activeElement!==i&&(0,l.HandleNativePlaceholder)(i,e.originalPlaceholder)},clickEvent:function(e,t){var i=this.inputmask,a=this;if((a.inputmask.shadowRoot||a.ownerDocument).activeElement===a){var r=n.determineNewCaretPosition.call(i,n.caret.call(i,a),t);void 0!==r&&n.caret.call(i,a,r)}},cutEvent:function(e){var t=this.inputmask,i=t.maskset,a=this,o=n.caret.call(t,a),u=t.isRTL?n.getBuffer.call(t).slice(o.end,o.begin):n.getBuffer.call(t).slice(o.begin,o.end),c=t.isRTL?u.reverse().join(""):u.join("");window.navigator.clipboard?window.navigator.clipboard.writeText(c):window.clipboardData&&window.clipboardData.getData&&window.clipboardData.setData("Text",c),s.handleRemove.call(t,a,r.default.DELETE,o),(0,l.writeBuffer)(a,n.getBuffer.call(t),i.p,e,t.undoValue!==t._valueGet(!0))},blurEvent:function(e){var t=this.inputmask,i=t.opts,a=(0,t.dependencyLib)(this),r=this;if(r.inputmask){(0,l.HandleNativePlaceholder)(r,t.originalPlaceholder);var o=r.inputmask._valueGet(),u=n.getBuffer.call(t).slice();""!==o&&(i.clearMaskOnLostFocus&&(-1===n.getLastValidPosition.call(t)&&o===n.getBufferTemplate.call(t).join("")?u=[]:l.clearOptionalTail.call(t,u)),!1===s.isComplete.call(t,u)&&(setTimeout((function(){a.trigger("incomplete")}),0),i.clearIncomplete&&(n.resetMaskSet.call(t),u=i.clearMaskOnLostFocus?[]:n.getBufferTemplate.call(t).slice())),(0,l.writeBuffer)(r,u,void 0,e)),t.undoValue!==t._valueGet(!0)&&(t.undoValue=t._valueGet(!0),a.trigger("change"))}},mouseenterEvent:function(){var e=this.inputmask,t=e.opts,i=this;if(e.mouseEnter=!0,(i.inputmask.shadowRoot||i.ownerDocument).activeElement!==i){var a=(e.isRTL?n.getBufferTemplate.call(e).slice().reverse():n.getBufferTemplate.call(e)).join("");e.placeholder!==a&&i.placeholder!==e.originalPlaceholder&&(e.originalPlaceholder=i.placeholder),t.showMaskOnHover&&(0,l.HandleNativePlaceholder)(i,a)}},submitEvent:function(){var e=this.inputmask,t=e.opts;e.undoValue!==e._valueGet(!0)&&e.$el.trigger("change"),-1===n.getLastValidPosition.call(e)&&e._valueGet&&e._valueGet()===n.getBufferTemplate.call(e).join("")&&e._valueSet(""),t.clearIncomplete&&!1===s.isComplete.call(e,n.getBuffer.call(e))&&e._valueSet(""),t.removeMaskOnSubmit&&(e._valueSet(e.unmaskedvalue(),!0),setTimeout((function(){(0,l.writeBuffer)(e.el,n.getBuffer.call(e))}),0))},resetEvent:function(){var e=this.inputmask;e.refreshValue=!0,setTimeout((function(){(0,l.applyInputValue)(e.el,e._valueGet(!0))}),0)}};t.EventHandlers=d},9716:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.EventRuler=void 0;var a=s(i(2394)),n=s(i(5581)),r=i(8711),o=i(7760);function s(e){return e&&e.__esModule?e:{default:e}}var l={on:function(e,t,i){var s=e.inputmask.dependencyLib,l=function(t){t.originalEvent&&(t=t.originalEvent||t,arguments[0]=t);var l,u=this,c=u.inputmask,f=c?c.opts:void 0;if(void 0===c&&"FORM"!==this.nodeName){var d=s.data(u,"_inputmask_opts");s(u).off(),d&&new a.default(d).mask(u)}else{if(["submit","reset","setvalue"].includes(t.type)||"FORM"===this.nodeName||!(u.disabled||u.readOnly&&!("keydown"===t.type&&t.ctrlKey&&67===t.keyCode||!1===f.tabThrough&&t.keyCode===n.default.TAB))){switch(t.type){case"input":if(!0===c.skipInputEvent||t.inputType&&"insertCompositionText"===t.inputType)return c.skipInputEvent=!1,t.preventDefault();break;case"keydown":c.skipKeyPressEvent=!1,c.skipInputEvent=c.isComposing=t.keyCode===n.default.KEY_229;break;case"keyup":case"compositionend":c.isComposing&&(c.skipInputEvent=!1);break;case"keypress":if(!0===c.skipKeyPressEvent)return t.preventDefault();c.skipKeyPressEvent=!0;break;case"click":case"focus":return c.validationEvent?(c.validationEvent=!1,e.blur(),(0,o.HandleNativePlaceholder)(e,(c.isRTL?r.getBufferTemplate.call(c).slice().reverse():r.getBufferTemplate.call(c)).join("")),setTimeout((function(){e.focus()}),f.validationEventTimeOut),!1):(l=arguments,void setTimeout((function(){e.inputmask&&i.apply(u,l)}),0))}var p=i.apply(u,arguments);return!1===p&&(t.preventDefault(),t.stopPropagation()),p}t.preventDefault()}};["submit","reset"].includes(t)?(l=l.bind(e),null!==e.form&&s(e.form).on(t,l)):s(e).on(t,l),e.inputmask.events[t]=e.inputmask.events[t]||[],e.inputmask.events[t].push(l)},off:function(e,t){if(e.inputmask&&e.inputmask.events){var i=e.inputmask.dependencyLib,a=e.inputmask.events;for(var n in t&&((a=[])[t]=e.inputmask.events[t]),a){for(var r=a[n];r.length>0;){var o=r.pop();["submit","reset"].includes(n)?null!==e.form&&i(e.form).off(n,o):i(e).off(n,o)}delete e.inputmask.events[n]}}}};t.EventRuler=l},219:function(e,t,i){var a=d(i(2394)),n=d(i(5581)),r=d(i(7184)),o=i(8711),s=i(4713);function l(e){return l="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},l(e)}function u(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var i=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null==i)return;var a,n,r=[],o=!0,s=!1;try{for(i=i.call(e);!(o=(a=i.next()).done)&&(r.push(a.value),!t||r.length!==t);o=!0);}catch(e){s=!0,n=e}finally{try{o||null==i.return||i.return()}finally{if(s)throw n}}return r}(e,t)||function(e,t){if(!e)return;if("string"==typeof e)return c(e,t);var i=Object.prototype.toString.call(e).slice(8,-1);"Object"===i&&e.constructor&&(i=e.constructor.name);if("Map"===i||"Set"===i)return Array.from(e);if("Arguments"===i||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i))return c(e,t)}(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function c(e,t){(null==t||t>e.length)&&(t=e.length);for(var i=0,a=new Array(t);i<t;i++)a[i]=e[i];return a}function f(e,t){for(var i=0;i<t.length;i++){var a=t[i];a.enumerable=a.enumerable||!1,a.configurable=!0,"value"in a&&(a.writable=!0),Object.defineProperty(e,a.key,a)}}function d(e){return e&&e.__esModule?e:{default:e}}var p=a.default.dependencyLib,h=function(){function e(t,i,a){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.mask=t,this.format=i,this.opts=a,this._date=new Date(1,0,1),this.initDateObject(t,this.opts)}var t,i,a;return t=e,(i=[{key:"date",get:function(){return void 0===this._date&&(this._date=new Date(1,0,1),this.initDateObject(void 0,this.opts)),this._date}},{key:"initDateObject",value:function(e,t){var i;for(P(t).lastIndex=0;i=P(t).exec(this.format);){var a=new RegExp("\\d+$").exec(i[0]),n=a?i[0][0]+"x":i[0],r=void 0;if(void 0!==e){if(a){var o=P(t).lastIndex,s=O(i.index,t);P(t).lastIndex=o,r=e.slice(0,e.indexOf(s.nextMatch[0]))}else r=e.slice(0,g[n]&&g[n][4]||n.length);e=e.slice(r.length)}Object.prototype.hasOwnProperty.call(g,n)&&this.setValue(this,r,n,g[n][2],g[n][1])}}},{key:"setValue",value:function(e,t,i,a,n){if(void 0!==t&&(e[a]="ampm"===a?t:t.replace(/[^0-9]/g,"0"),e["raw"+a]=t.replace(/\s/g,"_")),void 0!==n){var r=e[a];("day"===a&&29===parseInt(r)||"month"===a&&2===parseInt(r))&&(29!==parseInt(e.day)||2!==parseInt(e.month)||""!==e.year&&void 0!==e.year||e._date.setFullYear(2012,1,29)),"day"===a&&(m=!0,0===parseInt(r)&&(r=1)),"month"===a&&(m=!0),"year"===a&&(m=!0,r.length<4&&(r=w(r,4,!0))),""===r||isNaN(r)||n.call(e._date,r),"ampm"===a&&n.call(e._date,r)}}},{key:"reset",value:function(){this._date=new Date(1,0,1)}},{key:"reInit",value:function(){this._date=void 0,this.date}}])&&f(t.prototype,i),a&&f(t,a),Object.defineProperty(t,"prototype",{writable:!1}),e}(),v=(new Date).getFullYear(),m=!1,g={d:["[1-9]|[12][0-9]|3[01]",Date.prototype.setDate,"day",Date.prototype.getDate],dd:["0[1-9]|[12][0-9]|3[01]",Date.prototype.setDate,"day",function(){return w(Date.prototype.getDate.call(this),2)}],ddd:[""],dddd:[""],m:["[1-9]|1[012]",function(e){var t=e?parseInt(e):0;return t>0&&t--,Date.prototype.setMonth.call(this,t)},"month",function(){return Date.prototype.getMonth.call(this)+1}],mm:["0[1-9]|1[012]",function(e){var t=e?parseInt(e):0;return t>0&&t--,Date.prototype.setMonth.call(this,t)},"month",function(){return w(Date.prototype.getMonth.call(this)+1,2)}],mmm:[""],mmmm:[""],yy:["[0-9]{2}",Date.prototype.setFullYear,"year",function(){return w(Date.prototype.getFullYear.call(this),2)}],yyyy:["[0-9]{4}",Date.prototype.setFullYear,"year",function(){return w(Date.prototype.getFullYear.call(this),4)}],h:["[1-9]|1[0-2]",Date.prototype.setHours,"hours",Date.prototype.getHours],hh:["0[1-9]|1[0-2]",Date.prototype.setHours,"hours",function(){return w(Date.prototype.getHours.call(this),2)}],hx:[function(e){return"[0-9]{".concat(e,"}")},Date.prototype.setHours,"hours",function(e){return Date.prototype.getHours}],H:["1?[0-9]|2[0-3]",Date.prototype.setHours,"hours",Date.prototype.getHours],HH:["0[0-9]|1[0-9]|2[0-3]",Date.prototype.setHours,"hours",function(){return w(Date.prototype.getHours.call(this),2)}],Hx:[function(e){return"[0-9]{".concat(e,"}")},Date.prototype.setHours,"hours",function(e){return function(){return w(Date.prototype.getHours.call(this),e)}}],M:["[1-5]?[0-9]",Date.prototype.setMinutes,"minutes",Date.prototype.getMinutes],MM:["0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]",Date.prototype.setMinutes,"minutes",function(){return w(Date.prototype.getMinutes.call(this),2)}],s:["[1-5]?[0-9]",Date.prototype.setSeconds,"seconds",Date.prototype.getSeconds],ss:["0[0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]",Date.prototype.setSeconds,"seconds",function(){return w(Date.prototype.getSeconds.call(this),2)}],l:["[0-9]{3}",Date.prototype.setMilliseconds,"milliseconds",function(){return w(Date.prototype.getMilliseconds.call(this),3)},3],L:["[0-9]{2}",Date.prototype.setMilliseconds,"milliseconds",function(){return w(Date.prototype.getMilliseconds.call(this),2)},2],t:["[ap]",y,"ampm",b,1],tt:["[ap]m",y,"ampm",b,2],T:["[AP]",y,"ampm",b,1],TT:["[AP]M",y,"ampm",b,2],Z:[".*",void 0,"Z",function(){var e=this.toString().match(/\((.+)\)/)[1];e.includes(" ")&&(e=(e=e.replace("-"," ").toUpperCase()).split(" ").map((function(e){return u(e,1)[0]})).join(""));return e}],o:[""],S:[""]},k={isoDate:"yyyy-mm-dd",isoTime:"HH:MM:ss",isoDateTime:"yyyy-mm-dd'T'HH:MM:ss",isoUtcDateTime:"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"};function y(e){var t=this.getHours();e.toLowerCase().includes("p")?this.setHours(t+12):e.toLowerCase().includes("a")&&t>=12&&this.setHours(t-12)}function b(){var e=this.getHours();return(e=e||12)>=12?"PM":"AM"}function x(e){var t=new RegExp("\\d+$").exec(e[0]);if(t&&void 0!==t[0]){var i=g[e[0][0]+"x"].slice("");return i[0]=i[0](t[0]),i[3]=i[3](t[0]),i}if(g[e[0]])return g[e[0]]}function P(e){if(!e.tokenizer){var t=[],i=[];for(var a in g)if(/\.*x$/.test(a)){var n=a[0]+"\\d+";-1===i.indexOf(n)&&i.push(n)}else-1===t.indexOf(a[0])&&t.push(a[0]);e.tokenizer="("+(i.length>0?i.join("|")+"|":"")+t.join("+|")+")+?|.",e.tokenizer=new RegExp(e.tokenizer,"g")}return e.tokenizer}function E(e,t,i){if(!m)return!0;if(void 0===e.rawday||!isFinite(e.rawday)&&new Date(e.date.getFullYear(),isFinite(e.rawmonth)?e.month:e.date.getMonth()+1,0).getDate()>=e.day||"29"==e.day&&(!isFinite(e.rawyear)||void 0===e.rawyear||""===e.rawyear)||new Date(e.date.getFullYear(),isFinite(e.rawmonth)?e.month:e.date.getMonth()+1,0).getDate()>=e.day)return t;if("29"==e.day){var a=O(t.pos,i);if("yyyy"===a.targetMatch[0]&&t.pos-a.targetMatchIndex==2)return t.remove=t.pos+1,t}else if("02"==e.month&&"30"==e.day&&void 0!==t.c)return e.day="03",e.date.setDate(3),e.date.setMonth(1),t.insert=[{pos:t.pos,c:"0"},{pos:t.pos+1,c:t.c}],t.caret=o.seekNext.call(this,t.pos+1),t;return!1}function S(e,t,i,a){var n,o,s="";for(P(i).lastIndex=0;n=P(i).exec(e);){if(void 0===t)if(o=x(n))s+="("+o[0]+")";else switch(n[0]){case"[":s+="(";break;case"]":s+=")?";break;default:s+=(0,r.default)(n[0])}else if(o=x(n))if(!0!==a&&o[3])s+=o[3].call(t.date);else o[2]?s+=t["raw"+o[2]]:s+=n[0];else s+=n[0]}return s}function w(e,t,i){for(e=String(e),t=t||2;e.length<t;)e=i?e+"0":"0"+e;return e}function _(e,t,i){return"string"==typeof e?new h(e,t,i):e&&"object"===l(e)&&Object.prototype.hasOwnProperty.call(e,"date")?e:void 0}function M(e,t){return S(t.inputFormat,{date:e},t)}function O(e,t){var i,a,n=0,r=0;for(P(t).lastIndex=0;a=P(t).exec(t.inputFormat);){var o=new RegExp("\\d+$").exec(a[0]);if((n+=r=o?parseInt(o[0]):a[0].length)>=e+1){i=a,a=P(t).exec(t.inputFormat);break}}return{targetMatchIndex:n-r,nextMatch:a,targetMatch:i}}a.default.extendAliases({datetime:{mask:function(e){return e.numericInput=!1,g.S=e.i18n.ordinalSuffix.join("|"),e.inputFormat=k[e.inputFormat]||e.inputFormat,e.displayFormat=k[e.displayFormat]||e.displayFormat||e.inputFormat,e.outputFormat=k[e.outputFormat]||e.outputFormat||e.inputFormat,e.placeholder=""!==e.placeholder?e.placeholder:e.inputFormat.replace(/[[\]]/,""),e.regex=S(e.inputFormat,void 0,e),e.min=_(e.min,e.inputFormat,e),e.max=_(e.max,e.inputFormat,e),null},placeholder:"",inputFormat:"isoDateTime",displayFormat:null,outputFormat:null,min:null,max:null,skipOptionalPartCharacter:"",i18n:{dayNames:["Mon","Tue","Wed","Thu","Fri","Sat","Sun","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],monthNames:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","January","February","March","April","May","June","July","August","September","October","November","December"],ordinalSuffix:["st","nd","rd","th"]},preValidation:function(e,t,i,a,n,r,o,s){if(s)return!0;if(isNaN(i)&&e[t]!==i){var l=O(t,n);if(l.nextMatch&&l.nextMatch[0]===i&&l.targetMatch[0].length>1){var u=g[l.targetMatch[0]][0];if(new RegExp(u).test("0"+e[t-1]))return e[t]=e[t-1],e[t-1]="0",{fuzzy:!0,buffer:e,refreshFromBuffer:{start:t-1,end:t+1},pos:t+1}}}return!0},postValidation:function(e,t,i,a,n,r,o,l){var u,c;if(o)return!0;if(!1===a&&(((u=O(t+1,n)).targetMatch&&u.targetMatchIndex===t&&u.targetMatch[0].length>1&&void 0!==g[u.targetMatch[0]]||(u=O(t+2,n)).targetMatch&&u.targetMatchIndex===t+1&&u.targetMatch[0].length>1&&void 0!==g[u.targetMatch[0]])&&(c=g[u.targetMatch[0]][0]),void 0!==c&&(void 0!==r.validPositions[t+1]&&new RegExp(c).test(i+"0")?(e[t]=i,e[t+1]="0",a={pos:t+2,caret:t}):new RegExp(c).test("0"+i)&&(e[t]="0",e[t+1]=i,a={pos:t+2})),!1===a))return a;if(a.fuzzy&&(e=a.buffer,t=a.pos),(u=O(t,n)).targetMatch&&u.targetMatch[0]&&void 0!==g[u.targetMatch[0]]){var f=g[u.targetMatch[0]];c=f[0];var d=e.slice(u.targetMatchIndex,u.targetMatchIndex+u.targetMatch[0].length);if(!1===new RegExp(c).test(d.join(""))&&2===u.targetMatch[0].length&&r.validPositions[u.targetMatchIndex]&&r.validPositions[u.targetMatchIndex+1]&&(r.validPositions[u.targetMatchIndex+1].input="0"),"year"==f[2])for(var p=s.getMaskTemplate.call(this,!1,1,void 0,!0),h=t+1;h<e.length;h++)e[h]=p[h],delete r.validPositions[h]}var m=a,k=_(e.join(""),n.inputFormat,n);return m&&!isNaN(k.date.getTime())&&(n.prefillYear&&(m=function(e,t,i){if(e.year!==e.rawyear){var a=v.toString(),n=e.rawyear.replace(/[^0-9]/g,""),r=a.slice(0,n.length),o=a.slice(n.length);if(2===n.length&&n===r){var s=new Date(v,e.month-1,e.day);e.day==s.getDate()&&(!i.max||i.max.date.getTime()>=s.getTime())&&(e.date.setFullYear(v),e.year=a,t.insert=[{pos:t.pos+1,c:o[0]},{pos:t.pos+2,c:o[1]}])}}return t}(k,m,n)),m=function(e,t,i,a,n){if(!t)return t;if(t&&i.min&&!isNaN(i.min.date.getTime())){var r;for(e.reset(),P(i).lastIndex=0;r=P(i).exec(i.inputFormat);){var o;if((o=x(r))&&o[3]){for(var s=o[1],l=e[o[2]],u=i.min[o[2]],c=i.max?i.max[o[2]]:u,f=[],d=!1,p=0;p<u.length;p++)void 0!==a.validPositions[p+r.index]||d?(f[p]=l[p],d=d||l[p]>u[p]):(f[p]=u[p],"year"===o[2]&&l.length-1==p&&u!=c&&(f=(parseInt(f.join(""))+1).toString().split("")),"ampm"===o[2]&&u!=c&&i.min.date.getTime()>e.date.getTime()&&(f[p]=c[p]));s.call(e._date,f.join(""))}}t=i.min.date.getTime()<=e.date.getTime(),e.reInit()}return t&&i.max&&(isNaN(i.max.date.getTime())||(t=i.max.date.getTime()>=e.date.getTime())),t}(k,m=E.call(this,k,m,n),n,r)),void 0!==t&&m&&a.pos!==t?{buffer:S(n.inputFormat,k,n).split(""),refreshFromBuffer:{start:t,end:a.pos},pos:a.caret||a.pos}:m},onKeyDown:function(e,t,i,a){e.ctrlKey&&e.keyCode===n.default.RIGHT&&(this.inputmask._valueSet(M(new Date,a)),p(this).trigger("setvalue"))},onUnMask:function(e,t,i){return t?S(i.outputFormat,_(e,i.inputFormat,i),i,!0):t},casing:function(e,t,i,a){return 0==t.nativeDef.indexOf("[ap]")?e.toLowerCase():0==t.nativeDef.indexOf("[AP]")?e.toUpperCase():e},onBeforeMask:function(e,t){return"[object Date]"===Object.prototype.toString.call(e)&&(e=M(e,t)),e},insertMode:!1,shiftPositions:!1,keepStatic:!1,inputmode:"numeric",prefillYear:!0}})},3851:function(e,t,i){var a,n=(a=i(2394))&&a.__esModule?a:{default:a},r=i(8711),o=i(4713);n.default.extendDefinitions({A:{validator:"[A-Za-z\u0410-\u044f\u0401\u0451\xc0-\xff\xb5]",casing:"upper"},"&":{validator:"[0-9A-Za-z\u0410-\u044f\u0401\u0451\xc0-\xff\xb5]",casing:"upper"},"#":{validator:"[0-9A-Fa-f]",casing:"upper"}});var s=new RegExp("25[0-5]|2[0-4][0-9]|[01][0-9][0-9]");function l(e,t,i,a,n){return i-1>-1&&"."!==t.buffer[i-1]?(e=t.buffer[i-1]+e,e=i-2>-1&&"."!==t.buffer[i-2]?t.buffer[i-2]+e:"0"+e):e="00"+e,s.test(e)}n.default.extendAliases({cssunit:{regex:"[+-]?[0-9]+\\.?([0-9]+)?(px|em|rem|ex|%|in|cm|mm|pt|pc)"},url:{regex:"(https?|ftp)://.*",autoUnmask:!1,keepStatic:!1,tabThrough:!0},ip:{mask:"i{1,3}.j{1,3}.k{1,3}.l{1,3}",definitions:{i:{validator:l},j:{validator:l},k:{validator:l},l:{validator:l}},onUnMask:function(e,t,i){return e},inputmode:"decimal",substitutes:{",":"."}},email:{mask:function(e){var t="*{1,64}[.*{1,64}][.*{1,64}][.*{1,63}]@-{1,63}.-{1,63}[.-{1,63}][.-{1,63}]",i=t;if(e.separator)for(var a=0;a<e.quantifier;a++)i+="[".concat(e.separator).concat(t,"]");return i},greedy:!1,casing:"lower",separator:null,quantifier:5,skipOptionalPartCharacter:"",onBeforePaste:function(e,t){return(e=e.toLowerCase()).replace("mailto:","")},definitions:{"*":{validator:"[0-9\uff11-\uff19A-Za-z\u0410-\u044f\u0401\u0451\xc0-\xff\xb5!#$%&'*+/=?^_`{|}~-]"},"-":{validator:"[0-9A-Za-z-]"}},onUnMask:function(e,t,i){return e},inputmode:"email"},mac:{mask:"##:##:##:##:##:##"},vin:{mask:"V{13}9{4}",definitions:{V:{validator:"[A-HJ-NPR-Za-hj-npr-z\\d]",casing:"upper"}},clearIncomplete:!0,autoUnmask:!0},ssn:{mask:"999-99-9999",postValidation:function(e,t,i,a,n,s,l){var u=o.getMaskTemplate.call(this,!0,r.getLastValidPosition.call(this),!0,!0);return/^(?!219-09-9999|078-05-1120)(?!666|000|9.{2}).{3}-(?!00).{2}-(?!0{4}).{4}$/.test(u.join(""))}}})},207:function(e,t,i){var a=s(i(2394)),n=s(i(5581)),r=s(i(7184)),o=i(8711);function s(e){return e&&e.__esModule?e:{default:e}}var l=a.default.dependencyLib;function u(e,t){for(var i="",n=0;n<e.length;n++)a.default.prototype.definitions[e.charAt(n)]||t.definitions[e.charAt(n)]||t.optionalmarker[0]===e.charAt(n)||t.optionalmarker[1]===e.charAt(n)||t.quantifiermarker[0]===e.charAt(n)||t.quantifiermarker[1]===e.charAt(n)||t.groupmarker[0]===e.charAt(n)||t.groupmarker[1]===e.charAt(n)||t.alternatormarker===e.charAt(n)?i+="\\"+e.charAt(n):i+=e.charAt(n);return i}function c(e,t,i,a){if(e.length>0&&t>0&&(!i.digitsOptional||a)){var n=e.indexOf(i.radixPoint),r=!1;i.negationSymbol.back===e[e.length-1]&&(r=!0,e.length--),-1===n&&(e.push(i.radixPoint),n=e.length-1);for(var o=1;o<=t;o++)isFinite(e[n+o])||(e[n+o]="0")}return r&&e.push(i.negationSymbol.back),e}function f(e,t){var i=0;for(var a in"+"===e&&(i=o.seekNext.call(this,t.validPositions.length-1)),t.tests)if((a=parseInt(a))>=i)for(var n=0,r=t.tests[a].length;n<r;n++)if((void 0===t.validPositions[a]||"-"===e)&&t.tests[a][n].match.def===e)return a+(void 0!==t.validPositions[a]&&"-"!==e?1:0);return i}function d(e,t){for(var i=-1,a=0,n=t.validPositions.length;a<n;a++){var r=t.validPositions[a];if(r&&r.match.def===e){i=a;break}}return i}function p(e,t,i,a,n){var r=t.buffer?t.buffer.indexOf(n.radixPoint):-1,o=(-1!==r||a&&n.jitMasking)&&new RegExp(n.definitions[9].validator).test(e);return n._radixDance&&-1!==r&&o&&null==t.validPositions[r]?{insert:{pos:r===i?r+1:r,c:n.radixPoint},pos:i}:o}a.default.extendAliases({numeric:{mask:function(e){e.repeat=0,e.groupSeparator===e.radixPoint&&e.digits&&"0"!==e.digits&&("."===e.radixPoint?e.groupSeparator=",":","===e.radixPoint?e.groupSeparator=".":e.groupSeparator="")," "===e.groupSeparator&&(e.skipOptionalPartCharacter=void 0),e.placeholder.length>1&&(e.placeholder=e.placeholder.charAt(0)),"radixFocus"===e.positionCaretOnClick&&""===e.placeholder&&(e.positionCaretOnClick="lvp");var t="0",i=e.radixPoint;!0===e.numericInput&&void 0===e.__financeInput?(t="1",e.positionCaretOnClick="radixFocus"===e.positionCaretOnClick?"lvp":e.positionCaretOnClick,e.digitsOptional=!1,isNaN(e.digits)&&(e.digits=2),e._radixDance=!1,i=","===e.radixPoint?"?":"!",""!==e.radixPoint&&void 0===e.definitions[i]&&(e.definitions[i]={},e.definitions[i].validator="["+e.radixPoint+"]",e.definitions[i].placeholder=e.radixPoint,e.definitions[i].static=!0,e.definitions[i].generated=!0)):(e.__financeInput=!1,e.numericInput=!0);var a,n="[+]";if(n+=u(e.prefix,e),""!==e.groupSeparator?(void 0===e.definitions[e.groupSeparator]&&(e.definitions[e.groupSeparator]={},e.definitions[e.groupSeparator].validator="["+e.groupSeparator+"]",e.definitions[e.groupSeparator].placeholder=e.groupSeparator,e.definitions[e.groupSeparator].static=!0,e.definitions[e.groupSeparator].generated=!0),n+=e._mask(e)):n+="9{+}",void 0!==e.digits&&0!==e.digits){var o=e.digits.toString().split(",");isFinite(o[0])&&o[1]&&isFinite(o[1])?n+=i+t+"{"+e.digits+"}":(isNaN(e.digits)||parseInt(e.digits)>0)&&(e.digitsOptional||e.jitMasking?(a=n+i+t+"{0,"+e.digits+"}",e.keepStatic=!0):n+=i+t+"{"+e.digits+"}")}else e.inputmode="numeric";return n+=u(e.suffix,e),n+="[-]",a&&(n=[a+u(e.suffix,e)+"[-]",n]),e.greedy=!1,function(e){void 0===e.parseMinMaxOptions&&(null!==e.min&&(e.min=e.min.toString().replace(new RegExp((0,r.default)(e.groupSeparator),"g"),""),","===e.radixPoint&&(e.min=e.min.replace(e.radixPoint,".")),e.min=isFinite(e.min)?parseFloat(e.min):NaN,isNaN(e.min)&&(e.min=Number.MIN_VALUE)),null!==e.max&&(e.max=e.max.toString().replace(new RegExp((0,r.default)(e.groupSeparator),"g"),""),","===e.radixPoint&&(e.max=e.max.replace(e.radixPoint,".")),e.max=isFinite(e.max)?parseFloat(e.max):NaN,isNaN(e.max)&&(e.max=Number.MAX_VALUE)),e.parseMinMaxOptions="done")}(e),""!==e.radixPoint&&e.substituteRadixPoint&&(e.substitutes["."==e.radixPoint?",":"."]=e.radixPoint),n},_mask:function(e){return"("+e.groupSeparator+"999){+|1}"},digits:"*",digitsOptional:!0,enforceDigitsOnBlur:!1,radixPoint:".",positionCaretOnClick:"radixFocus",_radixDance:!0,groupSeparator:"",allowMinus:!0,negationSymbol:{front:"-",back:""},prefix:"",suffix:"",min:null,max:null,SetMaxOnOverflow:!1,step:1,inputType:"text",unmaskAsNumber:!1,roundingFN:Math.round,inputmode:"decimal",shortcuts:{k:"1000",m:"1000000"},placeholder:"0",greedy:!1,rightAlign:!0,insertMode:!0,autoUnmask:!1,skipOptionalPartCharacter:"",usePrototypeDefinitions:!1,stripLeadingZeroes:!0,substituteRadixPoint:!0,definitions:{0:{validator:p},1:{validator:p,definitionSymbol:"9"},9:{validator:"[0-9\uff10-\uff19\u0660-\u0669\u06f0-\u06f9]",definitionSymbol:"*"},"+":{validator:function(e,t,i,a,n){return n.allowMinus&&("-"===e||e===n.negationSymbol.front)}},"-":{validator:function(e,t,i,a,n){return n.allowMinus&&e===n.negationSymbol.back}}},preValidation:function(e,t,i,a,n,r,o,s){if(!1!==n.__financeInput&&i===n.radixPoint)return!1;var l=e.indexOf(n.radixPoint),u=t;if(t=function(e,t,i,a,n){return n._radixDance&&n.numericInput&&t!==n.negationSymbol.back&&e<=i&&(i>0||t==n.radixPoint)&&(void 0===a.validPositions[e-1]||a.validPositions[e-1].input!==n.negationSymbol.back)&&(e-=1),e}(t,i,l,r,n),"-"===i||i===n.negationSymbol.front){if(!0!==n.allowMinus)return!1;var c=!1,p=d("+",r),h=d("-",r);return-1!==p&&(c=[p,h]),!1!==c?{remove:c,caret:u-n.negationSymbol.back.length}:{insert:[{pos:f.call(this,"+",r),c:n.negationSymbol.front,fromIsValid:!0},{pos:f.call(this,"-",r),c:n.negationSymbol.back,fromIsValid:void 0}],caret:u+n.negationSymbol.back.length}}if(i===n.groupSeparator)return{caret:u};if(s)return!0;if(-1!==l&&!0===n._radixDance&&!1===a&&i===n.radixPoint&&void 0!==n.digits&&(isNaN(n.digits)||parseInt(n.digits)>0)&&l!==t)return{caret:n._radixDance&&t===l-1?l+1:l};if(!1===n.__financeInput)if(a){if(n.digitsOptional)return{rewritePosition:o.end};if(!n.digitsOptional){if(o.begin>l&&o.end<=l)return i===n.radixPoint?{insert:{pos:l+1,c:"0",fromIsValid:!0},rewritePosition:l}:{rewritePosition:l+1};if(o.begin<l)return{rewritePosition:o.begin-1}}}else if(!n.showMaskOnHover&&!n.showMaskOnFocus&&!n.digitsOptional&&n.digits>0&&""===this.__valueGet.call(this.el))return{rewritePosition:l};return{rewritePosition:t}},postValidation:function(e,t,i,a,n,r,o){if(!1===a)return a;if(o)return!0;if(null!==n.min||null!==n.max){var s=n.onUnMask(e.slice().reverse().join(""),void 0,l.extend({},n,{unmaskAsNumber:!0}));if(null!==n.min&&s<n.min&&(s.toString().length>n.min.toString().length||s<0))return!1;if(null!==n.max&&s>n.max)return!!n.SetMaxOnOverflow&&{refreshFromBuffer:!0,buffer:c(n.max.toString().replace(".",n.radixPoint).split(""),n.digits,n).reverse()}}return a},onUnMask:function(e,t,i){if(""===t&&!0===i.nullable)return t;var a=e.replace(i.prefix,"");return a=(a=a.replace(i.suffix,"")).replace(new RegExp((0,r.default)(i.groupSeparator),"g"),""),""!==i.placeholder.charAt(0)&&(a=a.replace(new RegExp(i.placeholder.charAt(0),"g"),"0")),i.unmaskAsNumber?(""!==i.radixPoint&&-1!==a.indexOf(i.radixPoint)&&(a=a.replace(r.default.call(this,i.radixPoint),".")),a=(a=a.replace(new RegExp("^"+(0,r.default)(i.negationSymbol.front)),"-")).replace(new RegExp((0,r.default)(i.negationSymbol.back)+"$"),""),Number(a)):a},isComplete:function(e,t){var i=(t.numericInput?e.slice().reverse():e).join("");return i=(i=(i=(i=(i=i.replace(new RegExp("^"+(0,r.default)(t.negationSymbol.front)),"-")).replace(new RegExp((0,r.default)(t.negationSymbol.back)+"$"),"")).replace(t.prefix,"")).replace(t.suffix,"")).replace(new RegExp((0,r.default)(t.groupSeparator)+"([0-9]{3})","g"),"$1"),","===t.radixPoint&&(i=i.replace((0,r.default)(t.radixPoint),".")),isFinite(i)},onBeforeMask:function(e,t){var i=t.radixPoint||",";isFinite(t.digits)&&(t.digits=parseInt(t.digits)),"number"!=typeof e&&"number"!==t.inputType||""===i||(e=e.toString().replace(".",i));var a="-"===e.charAt(0)||e.charAt(0)===t.negationSymbol.front,n=e.split(i),o=n[0].replace(/[^\-0-9]/g,""),s=n.length>1?n[1].replace(/[^0-9]/g,""):"",l=n.length>1;e=o+(""!==s?i+s:s);var u=0;if(""!==i&&(u=t.digitsOptional?t.digits<s.length?t.digits:s.length:t.digits,""!==s||!t.digitsOptional)){var f=Math.pow(10,u||1);e=e.replace((0,r.default)(i),"."),isNaN(parseFloat(e))||(e=(t.roundingFN(parseFloat(e)*f)/f).toFixed(u)),e=e.toString().replace(".",i)}if(0===t.digits&&-1!==e.indexOf(i)&&(e=e.substring(0,e.indexOf(i))),null!==t.min||null!==t.max){var d=e.toString().replace(i,".");null!==t.min&&d<t.min?e=t.min.toString().replace(".",i):null!==t.max&&d>t.max&&(e=t.max.toString().replace(".",i))}return a&&"-"!==e.charAt(0)&&(e="-"+e),c(e.toString().split(""),u,t,l).join("")},onBeforeWrite:function(e,t,i,a){function n(e,t){if(!1!==a.__financeInput||t){var i=e.indexOf(a.radixPoint);-1!==i&&e.splice(i,1)}if(""!==a.groupSeparator)for(;-1!==(i=e.indexOf(a.groupSeparator));)e.splice(i,1);return e}var o,s;if(a.stripLeadingZeroes&&(s=function(e,t){var i=new RegExp("(^"+(""!==t.negationSymbol.front?(0,r.default)(t.negationSymbol.front)+"?":"")+(0,r.default)(t.prefix)+")(.*)("+(0,r.default)(t.suffix)+(""!=t.negationSymbol.back?(0,r.default)(t.negationSymbol.back)+"?":"")+"$)").exec(e.slice().reverse().join("")),a=i?i[2]:"",n=!1;return a&&(a=a.split(t.radixPoint.charAt(0))[0],n=new RegExp("^[0"+t.groupSeparator+"]*").exec(a)),!(!n||!(n[0].length>1||n[0].length>0&&n[0].length<a.length))&&n}(t,a)))for(var u=t.join("").lastIndexOf(s[0].split("").reverse().join(""))-(s[0]==s.input?0:1),f=s[0]==s.input?1:0,d=s[0].length-f;d>0;d--)delete this.maskset.validPositions[u+d],delete t[u+d];if(e)switch(e.type){case"blur":case"checkval":if(null!==a.min){var p=a.onUnMask(t.slice().reverse().join(""),void 0,l.extend({},a,{unmaskAsNumber:!0}));if(null!==a.min&&p<a.min)return{refreshFromBuffer:!0,buffer:c(a.min.toString().replace(".",a.radixPoint).split(""),a.digits,a).reverse()}}if(t[t.length-1]===a.negationSymbol.front){var h=new RegExp("(^"+(""!=a.negationSymbol.front?(0,r.default)(a.negationSymbol.front)+"?":"")+(0,r.default)(a.prefix)+")(.*)("+(0,r.default)(a.suffix)+(""!=a.negationSymbol.back?(0,r.default)(a.negationSymbol.back)+"?":"")+"$)").exec(n(t.slice(),!0).reverse().join(""));0==(h?h[2]:"")&&(o={refreshFromBuffer:!0,buffer:[0]})}else if(""!==a.radixPoint){t.indexOf(a.radixPoint)===a.suffix.length&&(o&&o.buffer?o.buffer.splice(0,1+a.suffix.length):(t.splice(0,1+a.suffix.length),o={refreshFromBuffer:!0,buffer:n(t)}))}if(a.enforceDigitsOnBlur){var v=(o=o||{})&&o.buffer||t.slice().reverse();o.refreshFromBuffer=!0,o.buffer=c(v,a.digits,a,!0).reverse()}}return o},onKeyDown:function(e,t,i,a){var r,o=l(this);if(3!=e.location){var s,u=String.fromCharCode(e.keyCode).toLowerCase();if((s=a.shortcuts&&a.shortcuts[u])&&s.length>1)return this.inputmask.__valueSet.call(this,parseFloat(this.inputmask.unmaskedvalue())*parseInt(s)),o.trigger("setvalue"),!1}if(e.ctrlKey)switch(e.keyCode){case n.default.UP:return this.inputmask.__valueSet.call(this,parseFloat(this.inputmask.unmaskedvalue())+parseInt(a.step)),o.trigger("setvalue"),!1;case n.default.DOWN:return this.inputmask.__valueSet.call(this,parseFloat(this.inputmask.unmaskedvalue())-parseInt(a.step)),o.trigger("setvalue"),!1}if(!e.shiftKey&&(e.keyCode===n.default.DELETE||e.keyCode===n.default.BACKSPACE||e.keyCode===n.default.BACKSPACE_SAFARI)&&i.begin!==t.length){if(t[e.keyCode===n.default.DELETE?i.begin-1:i.end]===a.negationSymbol.front)return r=t.slice().reverse(),""!==a.negationSymbol.front&&r.shift(),""!==a.negationSymbol.back&&r.pop(),o.trigger("setvalue",[r.join(""),i.begin]),!1;if(!0===a._radixDance){var f=t.indexOf(a.radixPoint);if(a.digitsOptional){if(0===f)return(r=t.slice().reverse()).pop(),o.trigger("setvalue",[r.join(""),i.begin>=r.length?r.length:i.begin]),!1}else if(-1!==f&&(i.begin<f||i.end<f||e.keyCode===n.default.DELETE&&(i.begin===f||i.begin-1===f))){var d=void 0;return i.begin===i.end&&(e.keyCode===n.default.BACKSPACE||e.keyCode===n.default.BACKSPACE_SAFARI?i.begin++:e.keyCode===n.default.DELETE&&i.begin-1===f&&(d=l.extend({},i),i.begin--,i.end--)),(r=t.slice().reverse()).splice(r.length-i.begin,i.begin-i.end+1),r=c(r,a.digits,a).join(""),d&&(i=d),o.trigger("setvalue",[r,i.begin>=r.length?f+1:i.begin]),!1}}}}},currency:{prefix:"",groupSeparator:",",alias:"numeric",digits:2,digitsOptional:!1},decimal:{alias:"numeric"},integer:{alias:"numeric",inputmode:"numeric",digits:0},percentage:{alias:"numeric",min:0,max:100,suffix:" %",digits:0,allowMinus:!1},indianns:{alias:"numeric",_mask:function(e){return"("+e.groupSeparator+"99){*|1}("+e.groupSeparator+"999){1|1}"},groupSeparator:",",radixPoint:".",placeholder:"0",digits:2,digitsOptional:!1}})},9380:function(e,t,i){var a;Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0;var n=((a=i(8741))&&a.__esModule?a:{default:a}).default?window:{};t.default=n},7760:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.HandleNativePlaceholder=function(e,t){var i=e?e.inputmask:this;if(l.ie){if(e.inputmask._valueGet()!==t&&(e.placeholder!==t||""===e.placeholder)){var a=o.getBuffer.call(i).slice(),n=e.inputmask._valueGet();if(n!==t){var r=o.getLastValidPosition.call(i);-1===r&&n===o.getBufferTemplate.call(i).join("")?a=[]:-1!==r&&f.call(i,a),p(e,a)}}}else e.placeholder!==t&&(e.placeholder=t,""===e.placeholder&&e.removeAttribute("placeholder"))},t.applyInputValue=c,t.checkVal=d,t.clearOptionalTail=f,t.unmaskedvalue=function(e){var t=e?e.inputmask:this,i=t.opts,a=t.maskset;if(e){if(void 0===e.inputmask)return e.value;e.inputmask&&e.inputmask.refreshValue&&c(e,e.inputmask._valueGet(!0))}for(var n=[],r=a.validPositions,s=0,l=r.length;s<l;s++)r[s]&&r[s].match&&(1!=r[s].match.static||Array.isArray(a.metadata)&&!0!==r[s].generatedInput)&&n.push(r[s].input);var u=0===n.length?"":(t.isRTL?n.reverse():n).join("");if("function"==typeof i.onUnMask){var f=(t.isRTL?o.getBuffer.call(t).slice().reverse():o.getBuffer.call(t)).join("");u=i.onUnMask.call(t,f,u,i)}return u},t.writeBuffer=p;var a,n=(a=i(5581))&&a.__esModule?a:{default:a},r=i(4713),o=i(8711),s=i(7215),l=i(9845),u=i(6030);function c(e,t){var i=e?e.inputmask:this,a=i.opts;e.inputmask.refreshValue=!1,"function"==typeof a.onBeforeMask&&(t=a.onBeforeMask.call(i,t,a)||t),d(e,!0,!1,t=t.toString().split("")),i.undoValue=i._valueGet(!0),(a.clearMaskOnLostFocus||a.clearIncomplete)&&e.inputmask._valueGet()===o.getBufferTemplate.call(i).join("")&&-1===o.getLastValidPosition.call(i)&&e.inputmask._valueSet("")}function f(e){e.length=0;for(var t,i=r.getMaskTemplate.call(this,!0,0,!0,void 0,!0);void 0!==(t=i.shift());)e.push(t);return e}function d(e,t,i,a,n){var l=e?e.inputmask:this,c=l.maskset,f=l.opts,d=l.dependencyLib,h=a.slice(),v="",m=-1,g=void 0,k=f.skipOptionalPartCharacter;f.skipOptionalPartCharacter="",o.resetMaskSet.call(l),c.tests={},m=f.radixPoint?o.determineNewCaretPosition.call(l,{begin:0,end:0},!1,!1===f.__financeInput?"radixFocus":void 0).begin:0,c.p=m,l.caretPos={begin:m};var y=[],b=l.caretPos;if(h.forEach((function(e,t){if(void 0!==e){var a=new d.Event("_checkval");a.keyCode=e.toString().charCodeAt(0),v+=e;var n=o.getLastValidPosition.call(l,void 0,!0);!function(e,t){for(var i=r.getMaskTemplate.call(l,!0,0).slice(e,o.seekNext.call(l,e,!1,!1)).join("").replace(/'/g,""),a=i.indexOf(t);a>0&&" "===i[a-1];)a--;var n=0===a&&!o.isMask.call(l,e)&&(r.getTest.call(l,e).match.nativeDef===t.charAt(0)||!0===r.getTest.call(l,e).match.static&&r.getTest.call(l,e).match.nativeDef==="'"+t.charAt(0)||" "===r.getTest.call(l,e).match.nativeDef&&(r.getTest.call(l,e+1).match.nativeDef===t.charAt(0)||!0===r.getTest.call(l,e+1).match.static&&r.getTest.call(l,e+1).match.nativeDef==="'"+t.charAt(0)));if(!n&&a>0&&!o.isMask.call(l,e,!1,!0)){var s=o.seekNext.call(l,e);l.caretPos.begin<s&&(l.caretPos={begin:s})}return n}(m,v)?(g=u.EventHandlers.keypressEvent.call(l,a,!0,!1,i,l.caretPos.begin))&&(m=l.caretPos.begin+1,v=""):g=u.EventHandlers.keypressEvent.call(l,a,!0,!1,i,n+1),g?(void 0!==g.pos&&c.validPositions[g.pos]&&!0===c.validPositions[g.pos].match.static&&void 0===c.validPositions[g.pos].alternation&&(y.push(g.pos),l.isRTL||(g.forwardPosition=g.pos+1)),p.call(l,void 0,o.getBuffer.call(l),g.forwardPosition,a,!1),l.caretPos={begin:g.forwardPosition,end:g.forwardPosition},b=l.caretPos):void 0===c.validPositions[t]&&h[t]===r.getPlaceholder.call(l,t)&&o.isMask.call(l,t,!0)?l.caretPos.begin++:l.caretPos=b}})),y.length>0){var x,P,E=o.seekNext.call(l,-1,void 0,!1);if(!s.isComplete.call(l,o.getBuffer.call(l))&&y.length<=E||s.isComplete.call(l,o.getBuffer.call(l))&&y.length>0&&y.length!==E&&0===y[0])for(var S=E;void 0!==(x=y.shift());){var w=new d.Event("_checkval");if((P=c.validPositions[x]).generatedInput=!0,w.keyCode=P.input.charCodeAt(0),(g=u.EventHandlers.keypressEvent.call(l,w,!0,!1,i,S))&&void 0!==g.pos&&g.pos!==x&&c.validPositions[g.pos]&&!0===c.validPositions[g.pos].match.static)y.push(g.pos);else if(!g)break;S++}}t&&p.call(l,e,o.getBuffer.call(l),g?g.forwardPosition:l.caretPos.begin,n||new d.Event("checkval"),n&&("input"===n.type&&l.undoValue!==o.getBuffer.call(l).join("")||"paste"===n.type)),f.skipOptionalPartCharacter=k}function p(e,t,i,a,r){var l=e?e.inputmask:this,u=l.opts,c=l.dependencyLib;if(a&&"function"==typeof u.onBeforeWrite){var f=u.onBeforeWrite.call(l,a,t,i,u);if(f){if(f.refreshFromBuffer){var d=f.refreshFromBuffer;s.refreshFromBuffer.call(l,!0===d?d:d.start,d.end,f.buffer||t),t=o.getBuffer.call(l,!0)}void 0!==i&&(i=void 0!==f.caret?f.caret:i)}}if(void 0!==e&&(e.inputmask._valueSet(t.join("")),void 0===i||void 0!==a&&"blur"===a.type||o.caret.call(l,e,i,void 0,void 0,void 0!==a&&"keydown"===a.type&&(a.keyCode===n.default.DELETE||a.keyCode===n.default.BACKSPACE)),!0===r)){var p=c(e),h=e.inputmask._valueGet();e.inputmask.skipInputEvent=!0,p.trigger("input"),setTimeout((function(){h===o.getBufferTemplate.call(l).join("")?p.trigger("cleared"):!0===s.isComplete.call(l,t)&&p.trigger("complete")}),0)}}},2394:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.default=void 0,i(7149),i(3194);var a=i(157),n=m(i(3287)),r=m(i(9380)),o=i(2391),s=i(4713),l=i(8711),u=i(7215),c=i(7760),f=i(9716),d=m(i(7392)),p=m(i(3976)),h=m(i(8741));function v(e){return v="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},v(e)}function m(e){return e&&e.__esModule?e:{default:e}}var g=r.default.document,k="_inputmask_opts";function y(e,t,i){if(h.default){if(!(this instanceof y))return new y(e,t,i);this.dependencyLib=n.default,this.el=void 0,this.events={},this.maskset=void 0,!0!==i&&("[object Object]"===Object.prototype.toString.call(e)?t=e:(t=t||{},e&&(t.alias=e)),this.opts=n.default.extend(!0,{},this.defaults,t),this.noMasksCache=t&&void 0!==t.definitions,this.userOptions=t||{},b(this.opts.alias,t,this.opts)),this.refreshValue=!1,this.undoValue=void 0,this.$el=void 0,this.skipKeyPressEvent=!1,this.skipInputEvent=!1,this.validationEvent=!1,this.ignorable=!1,this.maxLength,this.mouseEnter=!1,this.originalPlaceholder=void 0,this.isComposing=!1}}function b(e,t,i){var a=y.prototype.aliases[e];return a?(a.alias&&b(a.alias,void 0,i),n.default.extend(!0,i,a),n.default.extend(!0,i,t),!0):(null===i.mask&&(i.mask=e),!1)}y.prototype={dataAttribute:"data-inputmask",defaults:p.default,definitions:d.default,aliases:{},masksCache:{},get isRTL(){return this.opts.isRTL||this.opts.numericInput},mask:function(e){var t=this;return"string"==typeof e&&(e=g.getElementById(e)||g.querySelectorAll(e)),(e=e.nodeName?[e]:Array.isArray(e)?e:[].slice.call(e)).forEach((function(e,i){var s=n.default.extend(!0,{},t.opts);if(function(e,t,i,a){function o(t,n){var o=""===a?t:a+"-"+t;null!==(n=void 0!==n?n:e.getAttribute(o))&&("string"==typeof n&&(0===t.indexOf("on")?n=r.default[n]:"false"===n?n=!1:"true"===n&&(n=!0)),i[t]=n)}if(!0===t.importDataAttributes){var s,l,u,c,f=e.getAttribute(a);if(f&&""!==f&&(f=f.replace(/'/g,'"'),l=JSON.parse("{"+f+"}")),l)for(c in u=void 0,l)if("alias"===c.toLowerCase()){u=l[c];break}for(s in o("alias",u),i.alias&&b(i.alias,i,t),t){if(l)for(c in u=void 0,l)if(c.toLowerCase()===s.toLowerCase()){u=l[c];break}o(s,u)}}n.default.extend(!0,t,i),("rtl"===e.dir||t.rightAlign)&&(e.style.textAlign="right");("rtl"===e.dir||t.numericInput)&&(e.dir="ltr",e.removeAttribute("dir"),t.isRTL=!0);return Object.keys(i).length}(e,s,n.default.extend(!0,{},t.userOptions),t.dataAttribute)){var l=(0,o.generateMaskSet)(s,t.noMasksCache);void 0!==l&&(void 0!==e.inputmask&&(e.inputmask.opts.autoUnmask=!0,e.inputmask.remove()),e.inputmask=new y(void 0,void 0,!0),e.inputmask.opts=s,e.inputmask.noMasksCache=t.noMasksCache,e.inputmask.userOptions=n.default.extend(!0,{},t.userOptions),e.inputmask.el=e,e.inputmask.$el=(0,n.default)(e),e.inputmask.maskset=l,n.default.data(e,k,t.userOptions),a.mask.call(e.inputmask))}})),e&&e[0]&&e[0].inputmask||this},option:function(e,t){return"string"==typeof e?this.opts[e]:"object"===v(e)?(n.default.extend(this.userOptions,e),this.el&&!0!==t&&this.mask(this.el),this):void 0},unmaskedvalue:function(e){if(this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache),void 0===this.el||void 0!==e){var t=("function"==typeof this.opts.onBeforeMask&&this.opts.onBeforeMask.call(this,e,this.opts)||e).split("");c.checkVal.call(this,void 0,!1,!1,t),"function"==typeof this.opts.onBeforeWrite&&this.opts.onBeforeWrite.call(this,void 0,l.getBuffer.call(this),0,this.opts)}return c.unmaskedvalue.call(this,this.el)},remove:function(){if(this.el){n.default.data(this.el,k,null);var e=this.opts.autoUnmask?(0,c.unmaskedvalue)(this.el):this._valueGet(this.opts.autoUnmask);e!==l.getBufferTemplate.call(this).join("")?this._valueSet(e,this.opts.autoUnmask):this._valueSet(""),f.EventRuler.off(this.el),Object.getOwnPropertyDescriptor&&Object.getPrototypeOf?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this.el),"value")&&this.__valueGet&&Object.defineProperty(this.el,"value",{get:this.__valueGet,set:this.__valueSet,configurable:!0}):g.__lookupGetter__&&this.el.__lookupGetter__("value")&&this.__valueGet&&(this.el.__defineGetter__("value",this.__valueGet),this.el.__defineSetter__("value",this.__valueSet)),this.el.inputmask=void 0}return this.el},getemptymask:function(){return this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache),(this.isRTL?l.getBufferTemplate.call(this).reverse():l.getBufferTemplate.call(this)).join("")},hasMaskedValue:function(){return!this.opts.autoUnmask},isComplete:function(){return this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache),u.isComplete.call(this,l.getBuffer.call(this))},getmetadata:function(){if(this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache),Array.isArray(this.maskset.metadata)){var e=s.getMaskTemplate.call(this,!0,0,!1).join("");return this.maskset.metadata.forEach((function(t){return t.mask!==e||(e=t,!1)})),e}return this.maskset.metadata},isValid:function(e){if(this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache),e){var t=("function"==typeof this.opts.onBeforeMask&&this.opts.onBeforeMask.call(this,e,this.opts)||e).split("");c.checkVal.call(this,void 0,!0,!1,t)}else e=this.isRTL?l.getBuffer.call(this).slice().reverse().join(""):l.getBuffer.call(this).join("");for(var i=l.getBuffer.call(this),a=l.determineLastRequiredPosition.call(this),n=i.length-1;n>a&&!l.isMask.call(this,n);n--);return i.splice(a,n+1-a),u.isComplete.call(this,i)&&e===(this.isRTL?l.getBuffer.call(this).slice().reverse().join(""):l.getBuffer.call(this).join(""))},format:function(e,t){this.maskset=this.maskset||(0,o.generateMaskSet)(this.opts,this.noMasksCache);var i=("function"==typeof this.opts.onBeforeMask&&this.opts.onBeforeMask.call(this,e,this.opts)||e).split("");c.checkVal.call(this,void 0,!0,!1,i);var a=this.isRTL?l.getBuffer.call(this).slice().reverse().join(""):l.getBuffer.call(this).join("");return t?{value:a,metadata:this.getmetadata()}:a},setValue:function(e){this.el&&(0,n.default)(this.el).trigger("setvalue",[e])},analyseMask:o.analyseMask},y.extendDefaults=function(e){n.default.extend(!0,y.prototype.defaults,e)},y.extendDefinitions=function(e){n.default.extend(!0,y.prototype.definitions,e)},y.extendAliases=function(e){n.default.extend(!0,y.prototype.aliases,e)},y.format=function(e,t,i){return y(t).format(e,i)},y.unmask=function(e,t){return y(t).unmaskedvalue(e)},y.isValid=function(e,t){return y(t).isValid(e)},y.remove=function(e){"string"==typeof e&&(e=g.getElementById(e)||g.querySelectorAll(e)),(e=e.nodeName?[e]:e).forEach((function(e){e.inputmask&&e.inputmask.remove()}))},y.setValue=function(e,t){"string"==typeof e&&(e=g.getElementById(e)||g.querySelectorAll(e)),(e=e.nodeName?[e]:e).forEach((function(e){e.inputmask?e.inputmask.setValue(t):(0,n.default)(e).trigger("setvalue",[t])}))},y.dependencyLib=n.default,r.default.Inputmask=y;var x=y;t.default=x},5296:function(e,t,i){function a(e){return a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},a(e)}var n=h(i(9380)),r=h(i(2394)),o=h(i(8741));function s(e,t){for(var i=0;i<t.length;i++){var a=t[i];a.enumerable=a.enumerable||!1,a.configurable=!0,"value"in a&&(a.writable=!0),Object.defineProperty(e,a.key,a)}}function l(e,t){if(t&&("object"===a(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}function u(e){var t="function"==typeof Map?new Map:void 0;return u=function(e){if(null===e||(i=e,-1===Function.toString.call(i).indexOf("[native code]")))return e;var i;if("function"!=typeof e)throw new TypeError("Super expression must either be null or a function");if(void 0!==t){if(t.has(e))return t.get(e);t.set(e,a)}function a(){return c(e,arguments,p(this).constructor)}return a.prototype=Object.create(e.prototype,{constructor:{value:a,enumerable:!1,writable:!0,configurable:!0}}),d(a,e)},u(e)}function c(e,t,i){return c=f()?Reflect.construct:function(e,t,i){var a=[null];a.push.apply(a,t);var n=new(Function.bind.apply(e,a));return i&&d(n,i.prototype),n},c.apply(null,arguments)}function f(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}function d(e,t){return d=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e},d(e,t)}function p(e){return p=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)},p(e)}function h(e){return e&&e.__esModule?e:{default:e}}var v=n.default.document;if(o.default&&v&&v.head&&v.head.attachShadow&&n.default.customElements&&void 0===n.default.customElements.get("input-mask")){var m=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&d(e,t)}(c,e);var t,i,a,n,o,u=(t=c,i=f(),function(){var e,a=p(t);if(i){var n=p(this).constructor;e=Reflect.construct(a,arguments,n)}else e=a.apply(this,arguments);return l(this,e)});function c(){var e;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,c);var t=(e=u.call(this)).getAttributeNames(),i=e.attachShadow({mode:"closed"}),a=v.createElement("input");for(var n in a.type="text",i.appendChild(a),t)Object.prototype.hasOwnProperty.call(t,n)&&a.setAttribute(t[n],e.getAttribute(t[n]));var o=new r.default;return o.dataAttribute="",o.mask(a),a.inputmask.shadowRoot=i,e}return a=c,n&&s(a.prototype,n),o&&s(a,o),Object.defineProperty(a,"prototype",{writable:!1}),a}(u(HTMLElement));n.default.customElements.define("input-mask",m)}},443:function(e,t,i){var a=o(i(7957)),n=o(i(2394));function r(e){return r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},r(e)}function o(e){return e&&e.__esModule?e:{default:e}}void 0===a.default.fn.inputmask&&(a.default.fn.inputmask=function(e,t){var i,o=this[0];if(void 0===t&&(t={}),"string"==typeof e)switch(e){case"unmaskedvalue":return o&&o.inputmask?o.inputmask.unmaskedvalue():(0,a.default)(o).val();case"remove":return this.each((function(){this.inputmask&&this.inputmask.remove()}));case"getemptymask":return o&&o.inputmask?o.inputmask.getemptymask():"";case"hasMaskedValue":return!(!o||!o.inputmask)&&o.inputmask.hasMaskedValue();case"isComplete":return!o||!o.inputmask||o.inputmask.isComplete();case"getmetadata":return o&&o.inputmask?o.inputmask.getmetadata():void 0;case"setvalue":n.default.setValue(o,t);break;case"option":if("string"!=typeof t)return this.each((function(){if(void 0!==this.inputmask)return this.inputmask.option(t)}));if(o&&void 0!==o.inputmask)return o.inputmask.option(t);break;default:return t.alias=e,i=new n.default(t),this.each((function(){i.mask(this)}))}else{if(Array.isArray(e))return t.alias=e,i=new n.default(t),this.each((function(){i.mask(this)}));if("object"==r(e))return i=new n.default(e),void 0===e.mask&&void 0===e.alias?this.each((function(){if(void 0!==this.inputmask)return this.inputmask.option(e);i.mask(this)})):this.each((function(){i.mask(this)}));if(void 0===e)return this.each((function(){(i=new n.default(t)).mask(this)}))}})},2391:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.analyseMask=function(e,t,i){var a,o,s,l,u,c,f=/(?:[?*+]|\{[0-9+*]+(?:,[0-9+*]*)?(?:\|[0-9+*]*)?\})|[^.?*+^${[]()|\\]+|./g,d=/\[\^?]?(?:[^\\\]]+|\\[\S\s]?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9][0-9]*|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)|\((?:\?[:=!]?)?|(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??|[^.?*+^${[()|\\]+|./g,p=!1,h=new n.default,v=[],m=[],g=!1;function k(e,a,n){n=void 0!==n?n:e.matches.length;var o=e.matches[n-1];if(t)0===a.indexOf("[")||p&&/\\d|\\s|\\w/i.test(a)||"."===a?e.matches.splice(n++,0,{fn:new RegExp(a,i.casing?"i":""),static:!1,optionality:!1,newBlockMarker:void 0===o?"master":o.def!==a,casing:null,def:a,placeholder:void 0,nativeDef:a}):(p&&(a=a[a.length-1]),a.split("").forEach((function(t,a){o=e.matches[n-1],e.matches.splice(n++,0,{fn:/[a-z]/i.test(i.staticDefinitionSymbol||t)?new RegExp("["+(i.staticDefinitionSymbol||t)+"]",i.casing?"i":""):null,static:!0,optionality:!1,newBlockMarker:void 0===o?"master":o.def!==t&&!0!==o.static,casing:null,def:i.staticDefinitionSymbol||t,placeholder:void 0!==i.staticDefinitionSymbol?t:void 0,nativeDef:(p?"'":"")+t})}))),p=!1;else{var s=i.definitions&&i.definitions[a]||i.usePrototypeDefinitions&&r.default.prototype.definitions[a];s&&!p?e.matches.splice(n++,0,{fn:s.validator?"string"==typeof s.validator?new RegExp(s.validator,i.casing?"i":""):new function(){this.test=s.validator}:new RegExp("."),static:s.static||!1,optionality:s.optional||!1,defOptionality:s.optional||!1,newBlockMarker:void 0===o||s.optional?"master":o.def!==(s.definitionSymbol||a),casing:s.casing,def:s.definitionSymbol||a,placeholder:s.placeholder,nativeDef:a,generated:s.generated}):(e.matches.splice(n++,0,{fn:/[a-z]/i.test(i.staticDefinitionSymbol||a)?new RegExp("["+(i.staticDefinitionSymbol||a)+"]",i.casing?"i":""):null,static:!0,optionality:!1,newBlockMarker:void 0===o?"master":o.def!==a&&!0!==o.static,casing:null,def:i.staticDefinitionSymbol||a,placeholder:void 0!==i.staticDefinitionSymbol?a:void 0,nativeDef:(p?"'":"")+a}),p=!1)}}function y(){if(v.length>0){if(k(l=v[v.length-1],o),l.isAlternator){u=v.pop();for(var e=0;e<u.matches.length;e++)u.matches[e].isGroup&&(u.matches[e].isGroup=!1);v.length>0?(l=v[v.length-1]).matches.push(u):h.matches.push(u)}}else k(h,o)}function b(e){var t=new n.default(!0);return t.openGroup=!1,t.matches=e,t}function x(){if((s=v.pop()).openGroup=!1,void 0!==s)if(v.length>0){if((l=v[v.length-1]).matches.push(s),l.isAlternator){for(var e=(u=v.pop()).matches[0].matches?u.matches[0].matches.length:1,t=0;t<u.matches.length;t++)u.matches[t].isGroup=!1,u.matches[t].alternatorGroup=!1,null===i.keepStatic&&e<(u.matches[t].matches?u.matches[t].matches.length:1)&&(i.keepStatic=!0),e=u.matches[t].matches?u.matches[t].matches.length:1;v.length>0?(l=v[v.length-1]).matches.push(u):h.matches.push(u)}}else h.matches.push(s);else y()}function P(e){var t=e.pop();return t.isQuantifier&&(t=b([e.pop(),t])),t}t&&(i.optionalmarker[0]=void 0,i.optionalmarker[1]=void 0);for(;a=t?d.exec(e):f.exec(e);){if(o=a[0],t){switch(o.charAt(0)){case"?":o="{0,1}";break;case"+":case"*":o="{"+o+"}";break;case"|":if(0===v.length){var E=b(h.matches);E.openGroup=!0,v.push(E),h.matches=[],g=!0}}if("\\d"===o)o="[0-9]"}if(p)y();else switch(o.charAt(0)){case"$":case"^":t||y();break;case i.escapeChar:p=!0,t&&y();break;case i.optionalmarker[1]:case i.groupmarker[1]:x();break;case i.optionalmarker[0]:v.push(new n.default(!1,!0));break;case i.groupmarker[0]:v.push(new n.default(!0));break;case i.quantifiermarker[0]:var S=new n.default(!1,!1,!0),w=(o=o.replace(/[{}?]/g,"")).split("|"),_=w[0].split(","),M=isNaN(_[0])?_[0]:parseInt(_[0]),O=1===_.length?M:isNaN(_[1])?_[1]:parseInt(_[1]),T=isNaN(w[1])?w[1]:parseInt(w[1]);"*"!==M&&"+"!==M||(M="*"===O?0:1),S.quantifier={min:M,max:O,jit:T};var A=v.length>0?v[v.length-1].matches:h.matches;if((a=A.pop()).isAlternator){A.push(a),A=a.matches;var C=new n.default(!0),D=A.pop();A.push(C),A=C.matches,a=D}a.isGroup||(a=b([a])),A.push(a),A.push(S);break;case i.alternatormarker:if(v.length>0){var j=(l=v[v.length-1]).matches[l.matches.length-1];c=l.openGroup&&(void 0===j.matches||!1===j.isGroup&&!1===j.isAlternator)?v.pop():P(l.matches)}else c=P(h.matches);if(c.isAlternator)v.push(c);else if(c.alternatorGroup?(u=v.pop(),c.alternatorGroup=!1):u=new n.default(!1,!1,!1,!0),u.matches.push(c),v.push(u),c.openGroup){c.openGroup=!1;var B=new n.default(!0);B.alternatorGroup=!0,v.push(B)}break;default:y()}}g&&x();for(;v.length>0;)s=v.pop(),h.matches.push(s);h.matches.length>0&&(!function e(a){a&&a.matches&&a.matches.forEach((function(n,r){var o=a.matches[r+1];(void 0===o||void 0===o.matches||!1===o.isQuantifier)&&n&&n.isGroup&&(n.isGroup=!1,t||(k(n,i.groupmarker[0],0),!0!==n.openGroup&&k(n,i.groupmarker[1]))),e(n)}))}(h),m.push(h));(i.numericInput||i.isRTL)&&function e(t){for(var a in t.matches=t.matches.reverse(),t.matches)if(Object.prototype.hasOwnProperty.call(t.matches,a)){var n=parseInt(a);if(t.matches[a].isQuantifier&&t.matches[n+1]&&t.matches[n+1].isGroup){var r=t.matches[a];t.matches.splice(a,1),t.matches.splice(n+1,0,r)}void 0!==t.matches[a].matches?t.matches[a]=e(t.matches[a]):t.matches[a]=((o=t.matches[a])===i.optionalmarker[0]?o=i.optionalmarker[1]:o===i.optionalmarker[1]?o=i.optionalmarker[0]:o===i.groupmarker[0]?o=i.groupmarker[1]:o===i.groupmarker[1]&&(o=i.groupmarker[0]),o)}var o;return t}(m[0]);return m},t.generateMaskSet=function(e,t){var i;function n(e,i,n){var s,l,u=!1;return null!==e&&""!==e||((u=null!==n.regex)?e=(e=n.regex).replace(/^(\^)(.*)(\$)$/,"$2"):(u=!0,e=".*")),1===e.length&&!1===n.greedy&&0!==n.repeat&&(n.placeholder=""),e=function(e,t){if(t.repeat>0||"*"===t.repeat||"+"===t.repeat){var i="*"===t.repeat?0:"+"===t.repeat?1:t.repeat;e=t.groupmarker[0]+e+t.groupmarker[1]+t.quantifiermarker[0]+i+","+t.repeat+t.quantifiermarker[1]}if(!0===t.keepStatic){var a=e.match(new RegExp("(?<p1>.)\\[(?<p2>[^\\]]*)\\]","g"));a&&a.forEach((function(t,i){var a=t.split("["),n=a[0],r=a[1].replace("]","");e=e.replace(new RegExp("".concat((0,o.default)(n),"\\[").concat((0,o.default)(r),"\\]")),n.charAt(0)===r.charAt(0)?"(".concat(n,"|").concat(n).concat(r,")"):"".concat(n,"[").concat(r,"]"))}))}return e}(e,n),l=u?"regex_"+n.regex:n.numericInput?e.split("").reverse().join(""):e,null!==n.keepStatic&&(l="ks_"+n.keepStatic+l),void 0===r.default.prototype.masksCache[l]||!0===t?(s={mask:e,maskToken:r.default.prototype.analyseMask(e,u,n),validPositions:[],_buffer:void 0,buffer:void 0,tests:{},excludes:{},metadata:i,maskLength:void 0,jitOffset:{}},!0!==t&&(r.default.prototype.masksCache[l]=s,s=a.default.extend(!0,{},r.default.prototype.masksCache[l]))):s=a.default.extend(!0,{},r.default.prototype.masksCache[l]),s}"function"==typeof e.mask&&(e.mask=e.mask(e));if(Array.isArray(e.mask)){if(e.mask.length>1){null===e.keepStatic&&(e.keepStatic=!0);var s=e.groupmarker[0];return(e.isRTL?e.mask.reverse():e.mask).forEach((function(t){s.length>1&&(s+=e.alternatormarker),void 0!==t.mask&&"function"!=typeof t.mask?s+=t.mask:s+=t})),n(s+=e.groupmarker[1],e.mask,e)}e.mask=e.mask.pop()}i=e.mask&&void 0!==e.mask.mask&&"function"!=typeof e.mask.mask?n(e.mask.mask,e.mask,e):n(e.mask,e.mask,e);null===e.keepStatic&&(e.keepStatic=!1);return i};var a=s(i(3287)),n=s(i(9695)),r=s(i(2394)),o=s(i(7184));function s(e){return e&&e.__esModule?e:{default:e}}},157:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.mask=function(){var e=this,t=this.opts,i=this.el,a=this.dependencyLib;s.EventRuler.off(i);var f=function(t,i){"textarea"!==t.tagName.toLowerCase()&&i.ignorables.push(n.default.ENTER);var l=t.getAttribute("type"),u="input"===t.tagName.toLowerCase()&&i.supportsInputType.includes(l)||t.isContentEditable||"textarea"===t.tagName.toLowerCase();if(!u)if("input"===t.tagName.toLowerCase()){var c=document.createElement("input");c.setAttribute("type",l),u="text"===c.type,c=null}else u="partial";return!1!==u?function(t){var n,l;function u(){return this.inputmask?this.inputmask.opts.autoUnmask?this.inputmask.unmaskedvalue():-1!==r.getLastValidPosition.call(e)||!0!==i.nullable?(this.inputmask.shadowRoot||this.ownerDocument).activeElement===this&&i.clearMaskOnLostFocus?(e.isRTL?o.clearOptionalTail.call(e,r.getBuffer.call(e).slice()).reverse():o.clearOptionalTail.call(e,r.getBuffer.call(e).slice())).join(""):n.call(this):"":n.call(this)}function c(e){l.call(this,e),this.inputmask&&(0,o.applyInputValue)(this,e)}if(!t.inputmask.__valueGet){if(!0!==i.noValuePatching){if(Object.getOwnPropertyDescriptor){var f=Object.getPrototypeOf?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t),"value"):void 0;f&&f.get&&f.set?(n=f.get,l=f.set,Object.defineProperty(t,"value",{get:u,set:c,configurable:!0})):"input"!==t.tagName.toLowerCase()&&(n=function(){return this.textContent},l=function(e){this.textContent=e},Object.defineProperty(t,"value",{get:u,set:c,configurable:!0}))}else document.__lookupGetter__&&t.__lookupGetter__("value")&&(n=t.__lookupGetter__("value"),l=t.__lookupSetter__("value"),t.__defineGetter__("value",u),t.__defineSetter__("value",c));t.inputmask.__valueGet=n,t.inputmask.__valueSet=l}t.inputmask._valueGet=function(t){return e.isRTL&&!0!==t?n.call(this.el).split("").reverse().join(""):n.call(this.el)},t.inputmask._valueSet=function(t,i){l.call(this.el,null==t?"":!0!==i&&e.isRTL?t.split("").reverse().join(""):t)},void 0===n&&(n=function(){return this.value},l=function(e){this.value=e},function(t){if(a.valHooks&&(void 0===a.valHooks[t]||!0!==a.valHooks[t].inputmaskpatch)){var n=a.valHooks[t]&&a.valHooks[t].get?a.valHooks[t].get:function(e){return e.value},s=a.valHooks[t]&&a.valHooks[t].set?a.valHooks[t].set:function(e,t){return e.value=t,e};a.valHooks[t]={get:function(t){if(t.inputmask){if(t.inputmask.opts.autoUnmask)return t.inputmask.unmaskedvalue();var a=n(t);return-1!==r.getLastValidPosition.call(e,void 0,void 0,t.inputmask.maskset.validPositions)||!0!==i.nullable?a:""}return n(t)},set:function(e,t){var i=s(e,t);return e.inputmask&&(0,o.applyInputValue)(e,t),i},inputmaskpatch:!0}}}(t.type),function(e){s.EventRuler.on(e,"mouseenter",(function(){var e=this,t=e.inputmask._valueGet(!0);t!=(e.inputmask.isRTL?r.getBuffer.call(e.inputmask).slice().reverse():r.getBuffer.call(e.inputmask)).join("")&&(0,o.applyInputValue)(e,t)}))}(t))}}(t):t.inputmask=void 0,u}(i,t);if(!1!==f){e.originalPlaceholder=i.placeholder,e.maxLength=void 0!==i?i.maxLength:void 0,-1===e.maxLength&&(e.maxLength=void 0),"inputMode"in i&&null===i.getAttribute("inputmode")&&(i.inputMode=t.inputmode,i.setAttribute("inputmode",t.inputmode)),!0===f&&(t.showMaskOnFocus=t.showMaskOnFocus&&-1===["cc-number","cc-exp"].indexOf(i.autocomplete),l.iphone&&(t.insertModeVisual=!1,i.setAttribute("autocorrect","off")),s.EventRuler.on(i,"submit",c.EventHandlers.submitEvent),s.EventRuler.on(i,"reset",c.EventHandlers.resetEvent),s.EventRuler.on(i,"blur",c.EventHandlers.blurEvent),s.EventRuler.on(i,"focus",c.EventHandlers.focusEvent),s.EventRuler.on(i,"invalid",c.EventHandlers.invalidEvent),s.EventRuler.on(i,"click",c.EventHandlers.clickEvent),s.EventRuler.on(i,"mouseleave",c.EventHandlers.mouseleaveEvent),s.EventRuler.on(i,"mouseenter",c.EventHandlers.mouseenterEvent),s.EventRuler.on(i,"paste",c.EventHandlers.pasteEvent),s.EventRuler.on(i,"cut",c.EventHandlers.cutEvent),s.EventRuler.on(i,"complete",t.oncomplete),s.EventRuler.on(i,"incomplete",t.onincomplete),s.EventRuler.on(i,"cleared",t.oncleared),!0!==t.inputEventOnly&&(s.EventRuler.on(i,"keydown",c.EventHandlers.keydownEvent),s.EventRuler.on(i,"keypress",c.EventHandlers.keypressEvent),s.EventRuler.on(i,"keyup",c.EventHandlers.keyupEvent)),(l.mobile||t.inputEventOnly)&&i.removeAttribute("maxLength"),s.EventRuler.on(i,"input",c.EventHandlers.inputFallBackEvent),s.EventRuler.on(i,"compositionend",c.EventHandlers.compositionendEvent)),s.EventRuler.on(i,"setvalue",c.EventHandlers.setValueEvent),r.getBufferTemplate.call(e).join(""),e.undoValue=e._valueGet(!0);var d=(i.inputmask.shadowRoot||i.ownerDocument).activeElement;if(""!==i.inputmask._valueGet(!0)||!1===t.clearMaskOnLostFocus||d===i){(0,o.applyInputValue)(i,i.inputmask._valueGet(!0),t);var p=r.getBuffer.call(e).slice();!1===u.isComplete.call(e,p)&&t.clearIncomplete&&r.resetMaskSet.call(e),t.clearMaskOnLostFocus&&d!==i&&(-1===r.getLastValidPosition.call(e)?p=[]:o.clearOptionalTail.call(e,p)),(!1===t.clearMaskOnLostFocus||t.showMaskOnFocus&&d===i||""!==i.inputmask._valueGet(!0))&&(0,o.writeBuffer)(i,p),d===i&&r.caret.call(e,i,r.seekNext.call(e,r.getLastValidPosition.call(e)))}}};var a,n=(a=i(5581))&&a.__esModule?a:{default:a},r=i(8711),o=i(7760),s=i(9716),l=i(9845),u=i(7215),c=i(6030)},9695:function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e,t,i,a){this.matches=[],this.openGroup=e||!1,this.alternatorGroup=!1,this.isGroup=e||!1,this.isOptional=t||!1,this.isQuantifier=i||!1,this.isAlternator=a||!1,this.quantifier={min:1,max:1}}},3194:function(){Array.prototype.includes||Object.defineProperty(Array.prototype,"includes",{value:function(e,t){if(null==this)throw new TypeError('"this" is null or not defined');var i=Object(this),a=i.length>>>0;if(0===a)return!1;for(var n=0|t,r=Math.max(n>=0?n:a-Math.abs(n),0);r<a;){if(i[r]===e)return!0;r++}return!1}})},7149:function(){function e(t){return e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},e(t)}"function"!=typeof Object.getPrototypeOf&&(Object.getPrototypeOf="object"===e("test".__proto__)?function(e){return e.__proto__}:function(e){return e.constructor.prototype})},8711:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.caret=function(e,t,i,a,n){var r,o=this,s=this.opts;if(void 0===t)return"selectionStart"in e&&"selectionEnd"in e?(t=e.selectionStart,i=e.selectionEnd):window.getSelection?(r=window.getSelection().getRangeAt(0)).commonAncestorContainer.parentNode!==e&&r.commonAncestorContainer!==e||(t=r.startOffset,i=r.endOffset):document.selection&&document.selection.createRange&&(r=document.selection.createRange(),t=0-r.duplicate().moveStart("character",-e.inputmask._valueGet().length),i=t+r.text.length),{begin:a?t:u.call(o,t),end:a?i:u.call(o,i)};if(Array.isArray(t)&&(i=o.isRTL?t[0]:t[1],t=o.isRTL?t[1]:t[0]),void 0!==t.begin&&(i=o.isRTL?t.begin:t.end,t=o.isRTL?t.end:t.begin),"number"==typeof t){t=a?t:u.call(o,t),i="number"==typeof(i=a?i:u.call(o,i))?i:t;var l=parseInt(((e.ownerDocument.defaultView||window).getComputedStyle?(e.ownerDocument.defaultView||window).getComputedStyle(e,null):e.currentStyle).fontSize)*i;if(e.scrollLeft=l>e.scrollWidth?l:0,e.inputmask.caretPos={begin:t,end:i},s.insertModeVisual&&!1===s.insertMode&&t===i&&(n||i++),e===(e.inputmask.shadowRoot||e.ownerDocument).activeElement)if("setSelectionRange"in e)e.setSelectionRange(t,i);else if(window.getSelection){if(r=document.createRange(),void 0===e.firstChild||null===e.firstChild){var c=document.createTextNode("");e.appendChild(c)}r.setStart(e.firstChild,t<e.inputmask._valueGet().length?t:e.inputmask._valueGet().length),r.setEnd(e.firstChild,i<e.inputmask._valueGet().length?i:e.inputmask._valueGet().length),r.collapse(!0);var f=window.getSelection();f.removeAllRanges(),f.addRange(r)}else e.createTextRange&&((r=e.createTextRange()).collapse(!0),r.moveEnd("character",i),r.moveStart("character",t),r.select())}},t.determineLastRequiredPosition=function(e){var t,i,r=this,s=this.maskset,l=this.dependencyLib,u=a.getMaskTemplate.call(r,!0,o.call(r),!0,!0),c=u.length,f=o.call(r),d={},p=s.validPositions[f],h=void 0!==p?p.locator.slice():void 0;for(t=f+1;t<u.length;t++)i=a.getTestTemplate.call(r,t,h,t-1),h=i.locator.slice(),d[t]=l.extend(!0,{},i);var v=p&&void 0!==p.alternation?p.locator[p.alternation]:void 0;for(t=c-1;t>f&&(((i=d[t]).match.optionality||i.match.optionalQuantifier&&i.match.newBlockMarker||v&&(v!==d[t].locator[p.alternation]&&1!=i.match.static||!0===i.match.static&&i.locator[p.alternation]&&n.checkAlternationMatch.call(r,i.locator[p.alternation].toString().split(","),v.toString().split(","))&&""!==a.getTests.call(r,t)[0].def))&&u[t]===a.getPlaceholder.call(r,t,i.match));t--)c--;return e?{l:c,def:d[c]?d[c].match:void 0}:c},t.determineNewCaretPosition=function(e,t,i){var n=this,u=this.maskset,c=this.opts;t&&(n.isRTL?e.end=e.begin:e.begin=e.end);if(e.begin===e.end){switch(i=i||c.positionCaretOnClick){case"none":break;case"select":e={begin:0,end:r.call(n).length};break;case"ignore":e.end=e.begin=l.call(n,o.call(n));break;case"radixFocus":if(function(e){if(""!==c.radixPoint&&0!==c.digits){var t=u.validPositions;if(void 0===t[e]||t[e].input===a.getPlaceholder.call(n,e)){if(e<l.call(n,-1))return!0;var i=r.call(n).indexOf(c.radixPoint);if(-1!==i){for(var o=0,s=t.length;o<s;o++)if(t[o]&&i<o&&t[o].input!==a.getPlaceholder.call(n,o))return!1;return!0}}}return!1}(e.begin)){var f=r.call(n).join("").indexOf(c.radixPoint);e.end=e.begin=c.numericInput?l.call(n,f):f;break}default:var d=e.begin,p=o.call(n,d,!0),h=l.call(n,-1!==p||s.call(n,0)?p:-1);if(d<=h)e.end=e.begin=s.call(n,d,!1,!0)?d:l.call(n,d);else{var v=u.validPositions[p],m=a.getTestTemplate.call(n,h,v?v.match.locator:void 0,v),g=a.getPlaceholder.call(n,h,m.match);if(""!==g&&r.call(n)[h]!==g&&!0!==m.match.optionalQuantifier&&!0!==m.match.newBlockMarker||!s.call(n,h,c.keepStatic,!0)&&m.match.def===g){var k=l.call(n,h);(d>=k||d===h)&&(h=k)}e.end=e.begin=h}}return e}},t.getBuffer=r,t.getBufferTemplate=function(){var e=this.maskset;void 0===e._buffer&&(e._buffer=a.getMaskTemplate.call(this,!1,1),void 0===e.buffer&&(e.buffer=e._buffer.slice()));return e._buffer},t.getLastValidPosition=o,t.isMask=s,t.resetMaskSet=function(e){var t=this.maskset;t.buffer=void 0,!0!==e&&(t.validPositions=[],t.p=0)},t.seekNext=l,t.seekPrevious=function(e,t){var i=this,n=e-1;if(e<=0)return 0;for(;n>0&&(!0===t&&(!0!==a.getTest.call(i,n).match.newBlockMarker||!s.call(i,n,void 0,!0))||!0!==t&&!s.call(i,n,void 0,!0));)n--;return n},t.translatePosition=u;var a=i(4713),n=i(7215);function r(e){var t=this.maskset;return void 0!==t.buffer&&!0!==e||(t.buffer=a.getMaskTemplate.call(this,!0,o.call(this),!0),void 0===t._buffer&&(t._buffer=t.buffer.slice())),t.buffer}function o(e,t,i){var a=this.maskset,n=-1,r=-1,o=i||a.validPositions;void 0===e&&(e=-1);for(var s=0,l=o.length;s<l;s++)o[s]&&(t||!0!==o[s].generatedInput)&&(s<=e&&(n=s),s>=e&&(r=s));return-1===n||n==e?r:-1==r||e-n<r-e?n:r}function s(e,t,i){var n=this,r=this.maskset,o=a.getTestTemplate.call(n,e).match;if(""===o.def&&(o=a.getTest.call(n,e).match),!0!==o.static)return o.fn;if(!0===i&&void 0!==r.validPositions[e]&&!0!==r.validPositions[e].generatedInput)return!0;if(!0!==t&&e>-1){if(i){var s=a.getTests.call(n,e);return s.length>1+(""===s[s.length-1].match.def?1:0)}var l=a.determineTestTemplate.call(n,e,a.getTests.call(n,e)),u=a.getPlaceholder.call(n,e,l.match);return l.match.def!==u}return!1}function l(e,t,i){var n=this;void 0===i&&(i=!0);for(var r=e+1;""!==a.getTest.call(n,r).match.def&&(!0===t&&(!0!==a.getTest.call(n,r).match.newBlockMarker||!s.call(n,r,void 0,!0))||!0!==t&&!s.call(n,r,void 0,i));)r++;return r}function u(e){var t=this.opts,i=this.el;return!this.isRTL||"number"!=typeof e||t.greedy&&""===t.placeholder||!i||(e=this._valueGet().length-e)<0&&(e=0),e}},4713:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.determineTestTemplate=u,t.getDecisionTaker=o,t.getMaskTemplate=function(e,t,i,a,n){var r=this,o=this.opts,c=this.maskset,f=o.greedy;n&&o.greedy&&(o.greedy=!1,r.maskset.tests={});t=t||0;var p,h,v,m,g=[],k=0;do{if(!0===e&&c.validPositions[k])v=n&&c.validPositions[k].match.optionality&&void 0===c.validPositions[k+1]&&(!0===c.validPositions[k].generatedInput||c.validPositions[k].input==o.skipOptionalPartCharacter&&k>0)?u.call(r,k,d.call(r,k,p,k-1)):c.validPositions[k],h=v.match,p=v.locator.slice(),g.push(!0===i?v.input:!1===i?h.nativeDef:s.call(r,k,h));else{v=l.call(r,k,p,k-1),h=v.match,p=v.locator.slice();var y=!0!==a&&(!1!==o.jitMasking?o.jitMasking:h.jit);(m=(m&&h.static&&h.def!==o.groupSeparator&&null===h.fn||c.validPositions[k-1]&&h.static&&h.def!==o.groupSeparator&&null===h.fn)&&c.tests[k]&&1===c.tests[k].length)||!1===y||void 0===y||"number"==typeof y&&isFinite(y)&&y>k?g.push(!1===i?h.nativeDef:s.call(r,g.length,h)):m=!1}k++}while(!0!==h.static||""!==h.def||t>k);""===g[g.length-1]&&g.pop();!1===i&&void 0!==c.maskLength||(c.maskLength=k-1);return o.greedy=f,g},t.getPlaceholder=s,t.getTest=c,t.getTestTemplate=l,t.getTests=d,t.isSubsetOf=f;var a,n=(a=i(2394))&&a.__esModule?a:{default:a};function r(e,t){var i=(null!=e.alternation?e.mloc[o(e)]:e.locator).join("");if(""!==i)for(;i.length<t;)i+="0";return i}function o(e){var t=e.locator[e.alternation];return"string"==typeof t&&t.length>0&&(t=t.split(",")[0]),void 0!==t?t.toString():""}function s(e,t,i){var a=this.opts,n=this.maskset;if(void 0!==(t=t||c.call(this,e).match).placeholder||!0===i)return"function"==typeof t.placeholder?t.placeholder(a):t.placeholder;if(!0===t.static){if(e>-1&&void 0===n.validPositions[e]){var r,o=d.call(this,e),s=[];if(o.length>1+(""===o[o.length-1].match.def?1:0))for(var l=0;l<o.length;l++)if(""!==o[l].match.def&&!0!==o[l].match.optionality&&!0!==o[l].match.optionalQuantifier&&(!0===o[l].match.static||void 0===r||!1!==o[l].match.fn.test(r.match.def,n,e,!0,a))&&(s.push(o[l]),!0===o[l].match.static&&(r=o[l]),s.length>1&&/[0-9a-bA-Z]/.test(s[0].match.def)))return a.placeholder.charAt(e%a.placeholder.length)}return t.def}return a.placeholder.charAt(e%a.placeholder.length)}function l(e,t,i){return this.maskset.validPositions[e]||u.call(this,e,d.call(this,e,t?t.slice():t,i))}function u(e,t){var i=this.opts,a=function(e,t){var i=0,a=!1;t.forEach((function(e){e.match.optionality&&(0!==i&&i!==e.match.optionality&&(a=!0),(0===i||i>e.match.optionality)&&(i=e.match.optionality))})),i&&(0==e||1==t.length?i=0:a||(i=0));return i}(e,t);e=e>0?e-1:0;var n,o,s,l=r(c.call(this,e));i.greedy&&t.length>1&&""===t[t.length-1].match.def&&t.pop();for(var u=0;u<t.length;u++){var f=t[u];n=r(f,l.length);var d=Math.abs(n-l);(void 0===o||""!==n&&d<o||s&&!i.greedy&&s.match.optionality&&s.match.optionality-a>0&&"master"===s.match.newBlockMarker&&(!f.match.optionality||f.match.optionality-a<1||!f.match.newBlockMarker)||s&&!i.greedy&&s.match.optionalQuantifier&&!f.match.optionalQuantifier)&&(o=d,s=f)}return s}function c(e,t){var i=this.maskset;return i.validPositions[e]?i.validPositions[e]:(t||d.call(this,e))[0]}function f(e,t,i){function a(e){for(var t,i=[],a=-1,n=0,r=e.length;n<r;n++)if("-"===e.charAt(n))for(t=e.charCodeAt(n+1);++a<t;)i.push(String.fromCharCode(a));else a=e.charCodeAt(n),i.push(e.charAt(n));return i.join("")}return e.match.def===t.match.nativeDef||!(!(i.regex||e.match.fn instanceof RegExp&&t.match.fn instanceof RegExp)||!0===e.match.static||!0===t.match.static)&&-1!==a(t.match.fn.toString().replace(/[[\]/]/g,"")).indexOf(a(e.match.fn.toString().replace(/[[\]/]/g,"")))}function d(e,t,i){var a,r,o=this,s=this.dependencyLib,l=this.maskset,c=this.opts,d=this.el,p=l.maskToken,h=t?i:0,v=t?t.slice():[0],m=[],g=!1,k=t?t.join(""):"";function y(t,i,r,o){function s(r,o,u){function p(e,t){var i=0===t.matches.indexOf(e);return i||t.matches.every((function(a,n){return!0===a.isQuantifier?i=p(e,t.matches[n-1]):Object.prototype.hasOwnProperty.call(a,"matches")&&(i=p(e,a)),!i})),i}function v(e,t,i){var a,n;if((l.tests[e]||l.validPositions[e])&&(l.tests[e]||[l.validPositions[e]]).every((function(e,r){if(e.mloc[t])return a=e,!1;var o=void 0!==i?i:e.alternation,s=void 0!==e.locator[o]?e.locator[o].toString().indexOf(t):-1;return(void 0===n||s<n)&&-1!==s&&(a=e,n=s),!0})),a){var r=a.locator[a.alternation];return(a.mloc[t]||a.mloc[r]||a.locator).slice((void 0!==i?i:a.alternation)+1)}return void 0!==i?v(e,t):void 0}function b(e,t){var i=e.alternation,a=void 0===t||i===t.alternation&&-1===e.locator[i].toString().indexOf(t.locator[i]);if(!a&&i>t.alternation)for(var n=t.alternation;n<i;n++)if(e.locator[n]!==t.locator[n]){i=n,a=!0;break}if(a){e.mloc=e.mloc||{};var r=e.locator[i];if(void 0!==r){if("string"==typeof r&&(r=r.split(",")[0]),void 0===e.mloc[r]&&(e.mloc[r]=e.locator.slice()),void 0!==t){for(var o in t.mloc)"string"==typeof o&&(o=o.split(",")[0]),void 0===e.mloc[o]&&(e.mloc[o]=t.mloc[o]);e.locator[i]=Object.keys(e.mloc).join(",")}return!0}e.alternation=void 0}return!1}function x(e,t){if(e.locator.length!==t.locator.length)return!1;for(var i=e.alternation+1;i<e.locator.length;i++)if(e.locator[i]!==t.locator[i])return!1;return!0}if(h>e+c._maxTestPos)throw"Inputmask: There is probably an error in your mask definition or in the code. Create an issue on github with an example of the mask you are using. "+l.mask;if(h===e&&void 0===r.matches){if(m.push({match:r,locator:o.reverse(),cd:k,mloc:{}}),!r.optionality||void 0!==u||!(c.definitions&&c.definitions[r.nativeDef]&&c.definitions[r.nativeDef].optional||n.default.prototype.definitions[r.nativeDef]&&n.default.prototype.definitions[r.nativeDef].optional))return!0;g=!0,h=e}else if(void 0!==r.matches){if(r.isGroup&&u!==r){if(r=s(t.matches[t.matches.indexOf(r)+1],o,u))return!0}else if(r.isOptional){var P=r,E=m.length;if(r=y(r,i,o,u)){if(m.forEach((function(e,t){t>=E&&(e.match.optionality=e.match.optionality?e.match.optionality+1:1)})),a=m[m.length-1].match,void 0!==u||!p(a,P))return!0;g=!0,h=e}}else if(r.isAlternator){var S,w=r,_=[],M=m.slice(),O=o.length,T=!1,A=i.length>0?i.shift():-1;if(-1===A||"string"==typeof A){var C,D=h,j=i.slice(),B=[];if("string"==typeof A)B=A.split(",");else for(C=0;C<w.matches.length;C++)B.push(C.toString());if(void 0!==l.excludes[e]){for(var R=B.slice(),L=0,I=l.excludes[e].length;L<I;L++){var F=l.excludes[e][L].toString().split(":");o.length==F[1]&&B.splice(B.indexOf(F[0]),1)}0===B.length&&(delete l.excludes[e],B=R)}(!0===c.keepStatic||isFinite(parseInt(c.keepStatic))&&D>=c.keepStatic)&&(B=B.slice(0,1));for(var N=0;N<B.length;N++){C=parseInt(B[N]),m=[],i="string"==typeof A&&v(h,C,O)||j.slice();var V=w.matches[C];if(V&&s(V,[C].concat(o),u))r=!0;else if(0===N&&(T=!0),V&&V.matches&&V.matches.length>w.matches[0].matches.length)break;S=m.slice(),h=D,m=[];for(var G=0;G<S.length;G++){var H=S[G],K=!1;H.match.jit=H.match.jit||T,H.alternation=H.alternation||O,b(H);for(var U=0;U<_.length;U++){var $=_[U];if("string"!=typeof A||void 0!==H.alternation&&B.includes(H.locator[H.alternation].toString())){if(H.match.nativeDef===$.match.nativeDef){K=!0,b($,H);break}if(f(H,$,c)){b(H,$)&&(K=!0,_.splice(_.indexOf($),0,H));break}if(f($,H,c)){b($,H);break}if(Z=$,!0===(W=H).match.static&&!0!==Z.match.static&&Z.match.fn.test(W.match.def,l,e,!1,c,!1)){x(H,$)||void 0!==d.inputmask.userOptions.keepStatic?b(H,$)&&(K=!0,_.splice(_.indexOf($),0,H)):c.keepStatic=!0;break}}}K||_.push(H)}}m=M.concat(_),h=e,g=m.length>0,r=_.length>0,i=j.slice()}else r=s(w.matches[A]||t.matches[A],[A].concat(o),u);if(r)return!0}else if(r.isQuantifier&&u!==t.matches[t.matches.indexOf(r)-1])for(var q=r,z=i.length>0?i.shift():0;z<(isNaN(q.quantifier.max)?z+1:q.quantifier.max)&&h<=e;z++){var Q=t.matches[t.matches.indexOf(q)-1];if(r=s(Q,[z].concat(o),Q)){if((a=m[m.length-1].match).optionalQuantifier=z>=q.quantifier.min,a.jit=(z+1)*(Q.matches.indexOf(a)+1)>q.quantifier.jit,a.optionalQuantifier&&p(a,Q)){g=!0,h=e;break}return a.jit&&(l.jitOffset[e]=Q.matches.length-Q.matches.indexOf(a)),!0}}else if(r=y(r,i,o,u))return!0}else h++;var W,Z}for(var u=i.length>0?i.shift():0;u<t.matches.length;u++)if(!0!==t.matches[u].isQuantifier){var p=s(t.matches[u],[u].concat(r),o);if(p&&h===e)return p;if(h>e)break}}if(e>-1){if(void 0===t){for(var b,x=e-1;void 0===(b=l.validPositions[x]||l.tests[x])&&x>-1;)x--;void 0!==b&&x>-1&&(v=function(e,t){var i,a=[];return Array.isArray(t)||(t=[t]),t.length>0&&(void 0===t[0].alternation||!0===c.keepStatic?0===(a=u.call(o,e,t.slice()).locator.slice()).length&&(a=t[0].locator.slice()):t.forEach((function(e){""!==e.def&&(0===a.length?(i=e.alternation,a=e.locator.slice()):e.locator[i]&&-1===a[i].toString().indexOf(e.locator[i])&&(a[i]+=","+e.locator[i]))}))),a}(x,b),k=v.join(""),h=x)}if(l.tests[e]&&l.tests[e][0].cd===k)return l.tests[e];for(var P=v.shift();P<p.length;P++){if(y(p[P],v,[P])&&h===e||h>e)break}}return(0===m.length||g)&&m.push({match:{fn:null,static:!0,optionality:!1,casing:null,def:"",placeholder:""},locator:[],mloc:{},cd:k}),void 0!==t&&l.tests[e]?r=s.extend(!0,[],m):(l.tests[e]=s.extend(!0,[],m),r=l.tests[e]),m.forEach((function(e){e.match.optionality=e.match.defOptionality||!1})),r}},7215:function(e,t,i){Object.defineProperty(t,"__esModule",{value:!0}),t.alternate=l,t.checkAlternationMatch=function(e,t,i){for(var a,n=this.opts.greedy?t:t.slice(0,1),r=!1,o=void 0!==i?i.split(","):[],s=0;s<o.length;s++)-1!==(a=e.indexOf(o[s]))&&e.splice(a,1);for(var l=0;l<e.length;l++)if(n.includes(e[l])){r=!0;break}return r},t.handleRemove=function(e,t,i,a,s){var u=this,c=this.maskset,f=this.opts;if((f.numericInput||u.isRTL)&&(t===r.default.BACKSPACE?t=r.default.DELETE:t===r.default.DELETE&&(t=r.default.BACKSPACE),u.isRTL)){var d=i.end;i.end=i.begin,i.begin=d}var p,h=o.getLastValidPosition.call(u,void 0,!0);i.end>=o.getBuffer.call(u).length&&h>=i.end&&(i.end=h+1);t===r.default.BACKSPACE?i.end-i.begin<1&&(i.begin=o.seekPrevious.call(u,i.begin)):t===r.default.DELETE&&i.begin===i.end&&(i.end=o.isMask.call(u,i.end,!0,!0)?i.end+1:o.seekNext.call(u,i.end)+1);if(!1!==(p=m.call(u,i))){if(!0!==a&&!1!==f.keepStatic||null!==f.regex&&-1!==n.getTest.call(u,i.begin).match.def.indexOf("|")){var v=l.call(u,!0);if(v){var g=void 0!==v.caret?v.caret:v.pos?o.seekNext.call(u,v.pos.begin?v.pos.begin:v.pos):o.getLastValidPosition.call(u,-1,!0);(t!==r.default.DELETE||i.begin>g)&&i.begin}}!0!==a&&(c.p=t===r.default.DELETE?i.begin+p:i.begin,c.p=o.determineNewCaretPosition.call(u,{begin:c.p,end:c.p},!1,!1===f.insertMode&&t===r.default.BACKSPACE?"none":void 0).begin)}},t.isComplete=c,t.isSelection=f,t.isValid=d,t.refreshFromBuffer=h,t.revalidateMask=m;var a,n=i(4713),r=(a=i(5581))&&a.__esModule?a:{default:a},o=i(8711),s=i(6030);function l(e,t,i,a,r,s){var u,c,f,p,h,v,m,g,k,y,b,x=this,P=this.dependencyLib,E=this.opts,S=x.maskset,w=P.extend(!0,[],S.validPositions),_=P.extend(!0,{},S.tests),M=!1,O=!1,T=void 0!==r?r:o.getLastValidPosition.call(x);if(s&&(y=s.begin,b=s.end,s.begin>s.end&&(y=s.end,b=s.begin)),-1===T&&void 0===r)u=0,c=(p=n.getTest.call(x,u)).alternation;else for(;T>=0;T--)if((f=S.validPositions[T])&&void 0!==f.alternation){if(p&&p.locator[f.alternation]!==f.locator[f.alternation])break;u=T,c=S.validPositions[u].alternation,p=f}if(void 0!==c){m=parseInt(u),S.excludes[m]=S.excludes[m]||[],!0!==e&&S.excludes[m].push((0,n.getDecisionTaker)(p)+":"+p.alternation);var A=[],C=-1;for(h=m;h<o.getLastValidPosition.call(x,void 0,!0)+1;h++)-1===C&&e<=h&&void 0!==t&&(A.push(t),C=A.length-1),(v=S.validPositions[h])&&!0!==v.generatedInput&&(void 0===s||h<y||h>=b)&&A.push(v.input),delete S.validPositions[h];for(-1===C&&void 0!==t&&(A.push(t),C=A.length-1);void 0!==S.excludes[m]&&S.excludes[m].length<10;){for(S.tests={},o.resetMaskSet.call(x,!0),M=!0,h=0;h<A.length&&(g=M.caret||o.getLastValidPosition.call(x,void 0,!0)+1,k=A[h],M=d.call(x,g,k,!1,a,!0));h++)h===C&&(O=M),1==e&&M&&(O={caretPos:h});if(M)break;if(o.resetMaskSet.call(x),p=n.getTest.call(x,m),S.validPositions=P.extend(!0,[],w),S.tests=P.extend(!0,{},_),!S.excludes[m]){O=l.call(x,e,t,i,a,m-1,s);break}var D=(0,n.getDecisionTaker)(p);if(-1!==S.excludes[m].indexOf(D+":"+p.alternation)){O=l.call(x,e,t,i,a,m-1,s);break}for(S.excludes[m].push(D+":"+p.alternation),h=m;h<o.getLastValidPosition.call(x,void 0,!0)+1;h++)delete S.validPositions[h]}}return O&&!1===E.keepStatic||delete S.excludes[m],O}function u(e,t,i){var a=this.opts,n=this.maskset;switch(a.casing||t.casing){case"upper":e=e.toUpperCase();break;case"lower":e=e.toLowerCase();break;case"title":var o=n.validPositions[i-1];e=0===i||o&&o.input===String.fromCharCode(r.default.SPACE)?e.toUpperCase():e.toLowerCase();break;default:if("function"==typeof a.casing){var s=Array.prototype.slice.call(arguments);s.push(n.validPositions),e=a.casing.apply(this,s)}}return e}function c(e){var t=this,i=this.opts,a=this.maskset;if("function"==typeof i.isComplete)return i.isComplete(e,i);if("*"!==i.repeat){var r=!1,s=o.determineLastRequiredPosition.call(t,!0),l=o.seekPrevious.call(t,s.l);if(void 0===s.def||s.def.newBlockMarker||s.def.optionality||s.def.optionalQuantifier){r=!0;for(var u=0;u<=l;u++){var c=n.getTestTemplate.call(t,u).match;if(!0!==c.static&&void 0===a.validPositions[u]&&!0!==c.optionality&&!0!==c.optionalQuantifier||!0===c.static&&e[u]!==n.getPlaceholder.call(t,u,c)){r=!1;break}}}return r}}function f(e){var t=this.opts.insertMode?0:1;return this.isRTL?e.begin-e.end>t:e.end-e.begin>t}function d(e,t,i,a,r,s,p){var g=this,k=this.dependencyLib,y=this.opts,b=g.maskset;i=!0===i;var x=e;function P(e){if(void 0!==e){if(void 0!==e.remove&&(Array.isArray(e.remove)||(e.remove=[e.remove]),e.remove.sort((function(e,t){return g.isRTL?e.pos-t.pos:t.pos-e.pos})).forEach((function(e){m.call(g,{begin:e,end:e+1})})),e.remove=void 0),void 0!==e.insert&&(Array.isArray(e.insert)||(e.insert=[e.insert]),e.insert.sort((function(e,t){return g.isRTL?t.pos-e.pos:e.pos-t.pos})).forEach((function(e){""!==e.c&&d.call(g,e.pos,e.c,void 0===e.strict||e.strict,void 0!==e.fromIsValid?e.fromIsValid:a)})),e.insert=void 0),e.refreshFromBuffer&&e.buffer){var t=e.refreshFromBuffer;h.call(g,!0===t?t:t.start,t.end,e.buffer),e.refreshFromBuffer=void 0}void 0!==e.rewritePosition&&(x=e.rewritePosition,e=!0)}return e}function E(t,i,r){var s=!1;return n.getTests.call(g,t).every((function(l,c){var d=l.match;if(o.getBuffer.call(g,!0),!1!==(s=(!d.jit||void 0!==b.validPositions[o.seekPrevious.call(g,t)])&&(null!=d.fn?d.fn.test(i,b,t,r,y,f.call(g,e)):(i===d.def||i===y.skipOptionalPartCharacter)&&""!==d.def&&{c:n.getPlaceholder.call(g,t,d,!0)||d.def,pos:t}))){var p=void 0!==s.c?s.c:i,h=t;return p=p===y.skipOptionalPartCharacter&&!0===d.static?n.getPlaceholder.call(g,t,d,!0)||d.def:p,!0!==(s=P(s))&&void 0!==s.pos&&s.pos!==t&&(h=s.pos),!0!==s&&void 0===s.pos&&void 0===s.c?!1:(!1===m.call(g,e,k.extend({},l,{input:u.call(g,p,d,h)}),a,h)&&(s=!1),!1)}return!0})),s}void 0!==e.begin&&(x=g.isRTL?e.end:e.begin);var S=!0,w=k.extend(!0,{},b.validPositions);if(!1===y.keepStatic&&void 0!==b.excludes[x]&&!0!==r&&!0!==a)for(var _=x;_<(g.isRTL?e.begin:e.end);_++)void 0!==b.excludes[_]&&(b.excludes[_]=void 0,delete b.tests[_]);if("function"==typeof y.preValidation&&!0!==a&&!0!==s&&(S=P(S=y.preValidation.call(g,o.getBuffer.call(g),x,t,f.call(g,e),y,b,e,i||r))),!0===S){if(S=E(x,t,i),(!i||!0===a)&&!1===S&&!0!==s){var M=b.validPositions[x];if(!M||!0!==M.match.static||M.match.def!==t&&t!==y.skipOptionalPartCharacter){if(y.insertMode||void 0===b.validPositions[o.seekNext.call(g,x)]||e.end>x){var O=!1;if(b.jitOffset[x]&&void 0===b.validPositions[o.seekNext.call(g,x)]&&!1!==(S=d.call(g,x+b.jitOffset[x],t,!0,!0))&&(!0!==r&&(S.caret=x),O=!0),e.end>x&&(b.validPositions[x]=void 0),!O&&!o.isMask.call(g,x,y.keepStatic&&0===x))for(var T=x+1,A=o.seekNext.call(g,x,!1,0!==x);T<=A;T++)if(!1!==(S=E(T,t,i))){S=v.call(g,x,void 0!==S.pos?S.pos:T)||S,x=T;break}}}else S={caret:o.seekNext.call(g,x)}}!1!==S||!y.keepStatic||!c.call(g,o.getBuffer.call(g))&&0!==x||i||!0===r?f.call(g,e)&&b.tests[x]&&b.tests[x].length>1&&y.keepStatic&&!i&&!0!==r&&(S=l.call(g,!0)):S=l.call(g,x,t,i,a,void 0,e),!0===S&&(S={pos:x})}if("function"==typeof y.postValidation&&!0!==a&&!0!==s){var C=y.postValidation.call(g,o.getBuffer.call(g,!0),void 0!==e.begin?g.isRTL?e.end:e.begin:e,t,S,y,b,i,p);void 0!==C&&(S=!0===C?S:C)}S&&void 0===S.pos&&(S.pos=x),!1===S||!0===s?(o.resetMaskSet.call(g,!0),b.validPositions=k.extend(!0,[],w)):v.call(g,void 0,x,!0);var D=P(S);void 0!==g.maxLength&&(o.getBuffer.call(g).length>g.maxLength&&!a&&(o.resetMaskSet.call(g,!0),b.validPositions=k.extend(!0,[],w),D=!1));return D}function p(e,t,i){for(var a=this.maskset,r=!1,o=n.getTests.call(this,e),s=0;s<o.length;s++){if(o[s].match&&(o[s].match.nativeDef===t.match[i.shiftPositions?"def":"nativeDef"]&&(!i.shiftPositions||!t.match.static)||o[s].match.nativeDef===t.match.nativeDef||i.regex&&!o[s].match.static&&o[s].match.fn.test(t.input))){r=!0;break}if(o[s].match&&o[s].match.def===t.match.nativeDef){r=void 0;break}}return!1===r&&void 0!==a.jitOffset[e]&&(r=p.call(this,e+a.jitOffset[e],t,i)),r}function h(e,t,i){var a,n,r=this,l=this.maskset,u=this.opts,c=this.dependencyLib,f=u.skipOptionalPartCharacter,d=r.isRTL?i.slice().reverse():i;if(u.skipOptionalPartCharacter="",!0===e)o.resetMaskSet.call(r),l.tests={},e=0,t=i.length,n=o.determineNewCaretPosition.call(r,{begin:0,end:0},!1).begin;else{for(a=e;a<t;a++)delete l.validPositions[a];n=e}var p=new c.Event("keypress");for(a=e;a<t;a++){p.keyCode=d[a].toString().charCodeAt(0),r.ignorable=!1;var h=s.EventHandlers.keypressEvent.call(r,p,!0,!1,!1,n);!1!==h&&void 0!==h&&(n=h.forwardPosition)}u.skipOptionalPartCharacter=f}function v(e,t,i){var a=this,r=this.maskset,s=this.dependencyLib;if(void 0===e)for(e=t-1;e>0&&!r.validPositions[e];e--);for(var l=e;l<t;l++){if(void 0===r.validPositions[l]&&!o.isMask.call(a,l,!1))if(0==l?n.getTest.call(a,l):r.validPositions[l-1]){var u=n.getTests.call(a,l).slice();""===u[u.length-1].match.def&&u.pop();var c,f=n.determineTestTemplate.call(a,l,u);if(f&&(!0!==f.match.jit||"master"===f.match.newBlockMarker&&(c=r.validPositions[l+1])&&!0===c.match.optionalQuantifier)&&((f=s.extend({},f,{input:n.getPlaceholder.call(a,l,f.match,!0)||f.match.def})).generatedInput=!0,m.call(a,l,f,!0),!0!==i)){var p=r.validPositions[t].input;return r.validPositions[t]=void 0,d.call(a,t,p,!0,!0)}}}}function m(e,t,i,a){var r=this,s=this.maskset,l=this.opts,u=this.dependencyLib;function c(e,t,i){var a=t[e];if(void 0!==a&&!0===a.match.static&&!0!==a.match.optionality&&(void 0===t[0]||void 0===t[0].alternation)){var n=i.begin<=e-1?t[e-1]&&!0===t[e-1].match.static&&t[e-1]:t[e-1],r=i.end>e+1?t[e+1]&&!0===t[e+1].match.static&&t[e+1]:t[e+1];return n&&r}return!1}var f=0,h=void 0!==e.begin?e.begin:e,v=void 0!==e.end?e.end:e,m=!0;if(e.begin>e.end&&(h=e.end,v=e.begin),a=void 0!==a?a:h,void 0===i&&(h!==v||l.insertMode&&void 0!==s.validPositions[a]||void 0===t||t.match.optionalQuantifier||t.match.optionality)){var g,k=u.extend(!0,{},s.validPositions),y=o.getLastValidPosition.call(r,void 0,!0);for(s.p=h,g=y;g>=h;g--)delete s.validPositions[g],void 0===t&&delete s.tests[g+1];var b,x,P=a,E=P;for(t&&(s.validPositions[a]=u.extend(!0,{},t),E++,P++),g=t?v:v-1;g<=y;g++){if(void 0!==(b=k[g])&&!0!==b.generatedInput&&(g>=v||g>=h&&c(g,k,{begin:h,end:v}))){for(;""!==n.getTest.call(r,E).match.def;){if(!1!==(x=p.call(r,E,b,l))||"+"===b.match.def){"+"===b.match.def&&o.getBuffer.call(r,!0);var S=d.call(r,E,b.input,"+"!==b.match.def,!0);if(m=!1!==S,P=(S.pos||E)+1,!m&&x)break}else m=!1;if(m){void 0===t&&b.match.static&&g===e.begin&&f++;break}if(!m&&o.getBuffer.call(r),E>s.maskLength)break;E++}""==n.getTest.call(r,E).match.def&&(m=!1),E=P}if(!m)break}if(!m)return s.validPositions=u.extend(!0,[],k),o.resetMaskSet.call(r,!0),!1}else t&&n.getTest.call(r,a).match.cd===t.match.cd&&(s.validPositions[a]=u.extend(!0,{},t));return o.resetMaskSet.call(r,!0),f}},7957:function(t){t.exports=e},5581:function(e){e.exports=JSON.parse('{"BACKSPACE":8,"BACKSPACE_SAFARI":127,"DELETE":46,"DOWN":40,"END":35,"ENTER":13,"ESCAPE":27,"HOME":36,"INSERT":45,"LEFT":37,"PAGE_DOWN":34,"PAGE_UP":33,"RIGHT":39,"SPACE":32,"TAB":9,"UP":38,"X":88,"Z":90,"CONTROL":17,"PAUSE/BREAK":19,"WINDOWS_LEFT":91,"WINDOWS_RIGHT":92,"KEY_229":229}')}},i={};function a(e){var n=i[e];if(void 0!==n)return n.exports;var r=i[e]={exports:{}};return t[e](r,r.exports,a),r.exports}var n={};return function(){var e=n;Object.defineProperty(e,"__esModule",{value:!0}),e.default=void 0;var t,i=(t=a(3046))&&t.__esModule?t:{default:t};a(443);var r=i.default;e.default=r}(),n}()}));
/*! jQuery DrawSVG v1.1.0 (2016-10-05) - git.io/vGFa5 - Copyright (c) 2016 Leonardo Santos - MIT License */
!(function (t) {
	"function" == typeof define && define.amd
		? define(["jquery"], t)
		: "object" == typeof module && module.exports
		? (module.exports = function (e, n) {
				return (
					void 0 === n &&
						(n =
							"undefined" != typeof window
								? require("jquery")
								: require("jquery")(e)),
					t(n),
					n
				);
		  })
		: t(jQuery);
})(function (t) {
	"use strict";
	var e = "drawsvg",
		n = {
			duration: 1e3,
			stagger: 200,
			easing: "swing",
			reverse: !1,
			callback: t.noop,
		},
		a = (function () {
			var a = function (a, o) {
				var i = this,
					r = t.extend(n, o);
				(i.$elm = t(a)),
					i.$elm.is("svg") &&
						((i.options = r),
						(i.$paths = i.$elm.find("path")),
						(i.totalDuration =
							r.duration + r.stagger * i.$paths.length),
						(i.duration = r.duration / i.totalDuration),
						i.$paths.each(function (t, e) {
							var n = e.getTotalLength();
							(e.pathLen = n),
								(e.delay = (r.stagger * t) / i.totalDuration),
								(e.style.strokeDasharray = [n, n].join(" ")),
								(e.style.strokeDashoffset = n);
						}),
						i.$elm.attr("class", function (t, n) {
							return [n, e + "-initialized"].join(" ");
						}));
			};
			return (
				(a.prototype.getVal = function (e, n) {
					return 1 - t.easing[n](e, e, 0, 1, 1);
				}),
				(a.prototype.progress = function (t) {
					var e = this,
						n = e.options,
						a = e.duration;
					e.$paths.each(function (o, i) {
						var r = i.style;
						if (1 === t) r.strokeDashoffset = 0;
						else if (0 === t) r.strokeDashoffset = i.pathLen + "px";
						else if (t >= i.delay && t <= a + i.delay) {
							var s = (t - i.delay) / a;
							r.strokeDashoffset =
								e.getVal(s, n.easing) *
									i.pathLen *
									(n.reverse ? -1 : 1) +
								"px";
						}
					});
				}),
				(a.prototype.animate = function () {
					var n = this;
					n.$elm.attr("class", function (t, n) {
						return [n, e + "-animating"].join(" ");
					}),
						t({ len: 0 }).animate(
							{ len: 1 },
							{
								easing: "linear",
								duration: n.totalDuration,
								step: function (t, e) {
									n.progress.call(n, t / e.end);
								},
								complete: function () {
									n.options.callback.call(this),
										n.$elm.attr("class", function (t, n) {
											return n.replace(
												e + "-animating",
												""
											);
										});
								},
							}
						);
				}),
				a
			);
		})();
	t.fn[e] = function (n, o) {
		return this.each(function () {
			var i = t.data(this, e);
			i && "" + n === n && i[n]
				? i[n](o)
				: t.data(this, e, new a(this, n));
		});
	};
});

/*!
  * KUTE.js Polyfill v2.1.1-alpha1 (http://thednp.github.io/kute.js)
  * Copyright 2015-2021 © thednp
  * Licensed under MIT (https://github.com/thednp/bootstrap.native/blob/master/LICENSE)
  */
 "use strict";
if (!Array.from) {
  Array.from = (function () {
    var toStr = Object.prototype.toString;
    var isCallable = function (fn) {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
    };
    var toInteger = function (value) {
      var number = Number(value);
      if (isNaN(number)) { return 0; }
      if (number === 0 || !isFinite(number)) { return number; }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
    };
    var maxSafeInteger = Math.pow(2, 53) - 1;
    var toLength = function (value) {
      var len = toInteger(value);
      return Math.min(Math.max(len, 0), maxSafeInteger);
    };

    return function from(arrayLike/*, mapFn, thisArg */) {
      var C = this, items = Object(arrayLike);
      if (arrayLike == null) {
        throw new TypeError('Array.from requires an array-like object - not null or undefined');
      }
      var mapFn = arguments.length > 1 ? arguments[1] : void undefined, T;
      if (typeof mapFn !== 'undefined') {
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        if (arguments.length > 2) {
          T = arguments[2];
        }
      }
      var len = toLength(items.length);
      var A = isCallable(C) ? Object(new C(len)) : new Array(len);

      var k = 0;
      var kValue;
      while (k < len) {
        kValue = items[k];
        if (mapFn) {
          A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
        } else {
          A[k] = kValue;
        }
        k += 1;
      }
      A.length = len;
      return A;
    }
  }());
}

// https://github.com/jonathantneal/array-flat-polyfill/blob/master/src/polyfill-flat.js

if (!Array.prototype.flat) {
	Object.defineProperty(Array.prototype, 'flat', {
		configurable: true,
		value: function flat () {
			var depth = isNaN(arguments[0]) ? 1 : Number(arguments[0]);

			return depth ? Array.prototype.reduce.call(this, function (acc, cur) {
				if (Array.isArray(cur)) {
					acc.push.apply(acc, flat.call(cur, depth - 1));
				} else {
					acc.push(cur);
				}

				return acc;
			}, []) : Array.prototype.slice.call(this);
		},
		writable: true
	});
}

if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
    var O = Object(this);
    var len = parseInt(O.length) || 0;
    if (len === 0) {
      return false;
    }
    var n = parseInt(arguments[1]) || 0;
    var k;
    if (n >= 0) {
      k = n;
    } else {
      k = len + n;
      if (k < 0) {k = 0;}
    }
    var currentElement;
    while (k < len) {
      currentElement = O[k];
      if (searchElement === currentElement ||
         (searchElement !== searchElement && currentElement !== currentElement)) {
        return true;
      }
      k++;
    }
    return false;
  };
}

if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    if (search instanceof RegExp) {
      throw TypeError('first argument must not be a RegExp');
    } 
    if (start === undefined) { start = 0; }
    return this.indexOf(search, start) !== -1;
  };
}

if (!Number.isFinite) {
  Number.isFinite = function(value) {
    return typeof value === 'number'
      && isFinite(value);
  };
}

if (!Number.isInteger) {
  Number.isInteger = function(value) {
    return typeof value === 'number'
      && isFinite(value)
      && Math.floor(value) === value;
  };
}

if (!Number.isNaN) {
  Number.isNaN = function(value) {
    return typeof value === 'number'
      && value !== value;
  };
}

/** @preserve jQuery animateNumber plugin v0.0.14
 * (c) 2013, Alexandr Borisov.
 * https://github.com/aishek/jquery-animateNumber
 */

// ['...'] notation using to avoid names minification by Google Closure Compiler
(function($) {
  var reverse = function(value) {
    return value.split('').reverse().join('');
  };

  var defaults = {
    numberStep: function(now, tween) {
      var floored_number = Math.floor(now),
          target = $(tween.elem);

      target.text(floored_number);
    }
  };

  var handle = function( tween ) {
    var elem = tween.elem;
    if ( elem.nodeType && elem.parentNode ) {
      var handler = elem._animateNumberSetter;
      if (!handler) {
        handler = defaults.numberStep;
      }
      handler(tween.now, tween);
    }
  };

  if (!$.Tween || !$.Tween.propHooks) {
    $.fx.step.number = handle;
  } else {
    $.Tween.propHooks.number = {
      set: handle
    };
  }

  var extract_number_parts = function(separated_number, group_length) {
    var numbers = separated_number.split('').reverse(),
        number_parts = [],
        current_number_part,
        current_index,
        q;

    for(var i = 0, l = Math.ceil(separated_number.length / group_length); i < l; i++) {
      current_number_part = '';
      for(q = 0; q < group_length; q++) {
        current_index = i * group_length + q;
        if (current_index === separated_number.length) {
          break;
        }

        current_number_part = current_number_part + numbers[current_index];
      }
      number_parts.push(current_number_part);
    }

    return number_parts;
  };

  var remove_precending_zeros = function(number_parts) {
    var last_index = number_parts.length - 1,
        last = reverse(number_parts[last_index]);

    number_parts[last_index] = reverse(parseInt(last, 10).toString());
    return number_parts;
  };

  $.animateNumber = {
    numberStepFactories: {
      /**
       * Creates numberStep handler, which appends string to floored animated number on each step.
       *
       * @example
       * // will animate to 100 with "1 %", "2 %", "3 %", ...
       * $('#someid').animateNumber({
       *   number: 100,
       *   numberStep: $.animateNumber.numberStepFactories.append(' %')
       * });
       *
       * @params {String} suffix string to append to animated number
       * @returns {Function} numberStep-compatible function for use in animateNumber's parameters
       */
      append: function(suffix) {
        return function(now, tween) {
          var floored_number = Math.floor(now),
              target = $(tween.elem);

          target.prop('number', now).text(floored_number + suffix);
        };
      },

      /**
       * Creates numberStep handler, which format floored numbers by separating them to groups.
       *
       * @example
       * // will animate with 1 ... 217,980 ... 95,217,980 ... 7,095,217,980
       * $('#world-population').animateNumber({
       *    number: 7095217980,
       *    numberStep: $.animateNumber.numberStepFactories.separator(',')
       * });
       * @example
       * // will animate with 1% ... 217,980% ... 95,217,980% ... 7,095,217,980%
       * $('#salesIncrease').animateNumber({
       *   number: 7095217980,
       *   numberStep: $.animateNumber.numberStepFactories.separator(',', 3, '%')
       * });
       *
       * @params {String} [separator=' '] string to separate number groups
       * @params {String} [group_length=3] number group length
       * @params {String} [suffix=''] suffix to append to number
       * @returns {Function} numberStep-compatible function for use in animateNumber's parameters
       */
      separator: function(separator, group_length, suffix) {
        separator = separator || ' ';
        group_length = group_length || 3;
        suffix = suffix || '';

        return function(now, tween) {
          var negative = now < 0,
              floored_number = Math.floor((negative ? -1 : 1) * now),
              separated_number = floored_number.toString(),
              target = $(tween.elem);

          if (separated_number.length > group_length) {
            var number_parts = extract_number_parts(separated_number, group_length);

            separated_number = remove_precending_zeros(number_parts).join(separator);
            separated_number = reverse(separated_number);
          }

          target.prop('number', now).text((negative ? '-' : '') + separated_number + suffix);
        };
      }
    }
  };

  $.fn.animateNumber = function() {
    var options = arguments[0],
        settings = $.extend({}, defaults, options),

        target = $(this),
        args = [settings];

    for(var i = 1, l = arguments.length; i < l; i++) {
      args.push(arguments[i]);
    }

    // needs of custom step function usage
    if (options.numberStep) {
      // assigns custom step functions
      var items = this.each(function(){
        this._animateNumberSetter = options.numberStep;
      });

      // cleanup of custom step functions after animation
      var generic_complete = settings.complete;
      settings.complete = function() {
        items.each(function(){
          delete this._animateNumberSetter;
        });

        if ( generic_complete ) {
          generic_complete.apply(this, arguments);
        }
      };
    }

    return target.animate.apply(target, args);
  };

}(jQuery));

!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).Parallax=t()}}(function(){return function t(e,i,n){function o(r,a){if(!i[r]){if(!e[r]){var l="function"==typeof require&&require;if(!a&&l)return l(r,!0);if(s)return s(r,!0);var h=new Error("Cannot find module '"+r+"'");throw h.code="MODULE_NOT_FOUND",h}var u=i[r]={exports:{}};e[r][0].call(u.exports,function(t){var i=e[r][1][t];return o(i||t)},u,u.exports,t,e,i,n)}return i[r].exports}for(var s="function"==typeof require&&require,r=0;r<n.length;r++)o(n[r]);return o}({1:[function(t,e,i){"use strict";function n(t){if(null===t||void 0===t)throw new TypeError("Object.assign cannot be called with null or undefined");return Object(t)}var o=Object.getOwnPropertySymbols,s=Object.prototype.hasOwnProperty,r=Object.prototype.propertyIsEnumerable;e.exports=function(){try{if(!Object.assign)return!1;var t=new String("abc");if(t[5]="de","5"===Object.getOwnPropertyNames(t)[0])return!1;for(var e={},i=0;i<10;i++)e["_"+String.fromCharCode(i)]=i;if("0123456789"!==Object.getOwnPropertyNames(e).map(function(t){return e[t]}).join(""))return!1;var n={};return"abcdefghijklmnopqrst".split("").forEach(function(t){n[t]=t}),"abcdefghijklmnopqrst"===Object.keys(Object.assign({},n)).join("")}catch(t){return!1}}()?Object.assign:function(t,e){for(var i,a,l=n(t),h=1;h<arguments.length;h++){i=Object(arguments[h]);for(var u in i)s.call(i,u)&&(l[u]=i[u]);if(o){a=o(i);for(var c=0;c<a.length;c++)r.call(i,a[c])&&(l[a[c]]=i[a[c]])}}return l}},{}],2:[function(t,e,i){(function(t){(function(){var i,n,o,s,r,a;"undefined"!=typeof performance&&null!==performance&&performance.now?e.exports=function(){return performance.now()}:void 0!==t&&null!==t&&t.hrtime?(e.exports=function(){return(i()-r)/1e6},n=t.hrtime,s=(i=function(){var t;return 1e9*(t=n())[0]+t[1]})(),a=1e9*t.uptime(),r=s-a):Date.now?(e.exports=function(){return Date.now()-o},o=Date.now()):(e.exports=function(){return(new Date).getTime()-o},o=(new Date).getTime())}).call(this)}).call(this,t("_process"))},{_process:3}],3:[function(t,e,i){function n(){throw new Error("setTimeout has not been defined")}function o(){throw new Error("clearTimeout has not been defined")}function s(t){if(c===setTimeout)return setTimeout(t,0);if((c===n||!c)&&setTimeout)return c=setTimeout,setTimeout(t,0);try{return c(t,0)}catch(e){try{return c.call(null,t,0)}catch(e){return c.call(this,t,0)}}}function r(t){if(d===clearTimeout)return clearTimeout(t);if((d===o||!d)&&clearTimeout)return d=clearTimeout,clearTimeout(t);try{return d(t)}catch(e){try{return d.call(null,t)}catch(e){return d.call(this,t)}}}function a(){v&&p&&(v=!1,p.length?f=p.concat(f):y=-1,f.length&&l())}function l(){if(!v){var t=s(a);v=!0;for(var e=f.length;e;){for(p=f,f=[];++y<e;)p&&p[y].run();y=-1,e=f.length}p=null,v=!1,r(t)}}function h(t,e){this.fun=t,this.array=e}function u(){}var c,d,m=e.exports={};!function(){try{c="function"==typeof setTimeout?setTimeout:n}catch(t){c=n}try{d="function"==typeof clearTimeout?clearTimeout:o}catch(t){d=o}}();var p,f=[],v=!1,y=-1;m.nextTick=function(t){var e=new Array(arguments.length-1);if(arguments.length>1)for(var i=1;i<arguments.length;i++)e[i-1]=arguments[i];f.push(new h(t,e)),1!==f.length||v||s(l)},h.prototype.run=function(){this.fun.apply(null,this.array)},m.title="browser",m.browser=!0,m.env={},m.argv=[],m.version="",m.versions={},m.on=u,m.addListener=u,m.once=u,m.off=u,m.removeListener=u,m.removeAllListeners=u,m.emit=u,m.prependListener=u,m.prependOnceListener=u,m.listeners=function(t){return[]},m.binding=function(t){throw new Error("process.binding is not supported")},m.cwd=function(){return"/"},m.chdir=function(t){throw new Error("process.chdir is not supported")},m.umask=function(){return 0}},{}],4:[function(t,e,i){(function(i){for(var n=t("performance-now"),o="undefined"==typeof window?i:window,s=["moz","webkit"],r="AnimationFrame",a=o["request"+r],l=o["cancel"+r]||o["cancelRequest"+r],h=0;!a&&h<s.length;h++)a=o[s[h]+"Request"+r],l=o[s[h]+"Cancel"+r]||o[s[h]+"CancelRequest"+r];if(!a||!l){var u=0,c=0,d=[];a=function(t){if(0===d.length){var e=n(),i=Math.max(0,1e3/60-(e-u));u=i+e,setTimeout(function(){var t=d.slice(0);d.length=0;for(var e=0;e<t.length;e++)if(!t[e].cancelled)try{t[e].callback(u)}catch(t){setTimeout(function(){throw t},0)}},Math.round(i))}return d.push({handle:++c,callback:t,cancelled:!1}),c},l=function(t){for(var e=0;e<d.length;e++)d[e].handle===t&&(d[e].cancelled=!0)}}e.exports=function(t){return a.call(o,t)},e.exports.cancel=function(){l.apply(o,arguments)},e.exports.polyfill=function(){o.requestAnimationFrame=a,o.cancelAnimationFrame=l}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"performance-now":2}],5:[function(t,e,i){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var o=function(){function t(t,e){for(var i=0;i<e.length;i++){var n=e[i];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,i,n){return i&&t(e.prototype,i),n&&t(e,n),e}}(),s=t("raf"),r=t("object-assign"),a={propertyCache:{},vendors:[null,["-webkit-","webkit"],["-moz-","Moz"],["-o-","O"],["-ms-","ms"]],clamp:function(t,e,i){return e<i?t<e?e:t>i?i:t:t<i?i:t>e?e:t},data:function(t,e){return a.deserialize(t.getAttribute("data-"+e))},deserialize:function(t){return"true"===t||"false"!==t&&("null"===t?null:!isNaN(parseFloat(t))&&isFinite(t)?parseFloat(t):t)},camelCase:function(t){return t.replace(/-+(.)?/g,function(t,e){return e?e.toUpperCase():""})},accelerate:function(t){a.css(t,"transform","translate3d(0,0,0) rotate(0.0001deg)"),a.css(t,"transform-style","preserve-3d"),a.css(t,"backface-visibility","hidden")},transformSupport:function(t){for(var e=document.createElement("div"),i=!1,n=null,o=!1,s=null,r=null,l=0,h=a.vendors.length;l<h;l++)if(null!==a.vendors[l]?(s=a.vendors[l][0]+"transform",r=a.vendors[l][1]+"Transform"):(s="transform",r="transform"),void 0!==e.style[r]){i=!0;break}switch(t){case"2D":o=i;break;case"3D":if(i){var u=document.body||document.createElement("body"),c=document.documentElement,d=c.style.overflow,m=!1;document.body||(m=!0,c.style.overflow="hidden",c.appendChild(u),u.style.overflow="hidden",u.style.background=""),u.appendChild(e),e.style[r]="translate3d(1px,1px,1px)",o=void 0!==(n=window.getComputedStyle(e).getPropertyValue(s))&&n.length>0&&"none"!==n,c.style.overflow=d,u.removeChild(e),m&&(u.removeAttribute("style"),u.parentNode.removeChild(u))}}return o},css:function(t,e,i){var n=a.propertyCache[e];if(!n)for(var o=0,s=a.vendors.length;o<s;o++)if(n=null!==a.vendors[o]?a.camelCase(a.vendors[o][1]+"-"+e):e,void 0!==t.style[n]){a.propertyCache[e]=n;break}t.style[n]=i}},l={relativeInput:!1,clipRelativeInput:!1,inputElement:null,hoverOnly:!1,calibrationThreshold:100,calibrationDelay:500,supportDelay:500,calibrateX:!1,calibrateY:!0,invertX:!0,invertY:!0,limitX:!1,limitY:!1,scalarX:10,scalarY:10,frictionX:.1,frictionY:.1,originX:.5,originY:.5,pointerEvents:!1,precision:1,onReady:null,selector:null},h=function(){function t(e,i){n(this,t),this.element=e;var o={calibrateX:a.data(this.element,"calibrate-x"),calibrateY:a.data(this.element,"calibrate-y"),invertX:a.data(this.element,"invert-x"),invertY:a.data(this.element,"invert-y"),limitX:a.data(this.element,"limit-x"),limitY:a.data(this.element,"limit-y"),scalarX:a.data(this.element,"scalar-x"),scalarY:a.data(this.element,"scalar-y"),frictionX:a.data(this.element,"friction-x"),frictionY:a.data(this.element,"friction-y"),originX:a.data(this.element,"origin-x"),originY:a.data(this.element,"origin-y"),pointerEvents:a.data(this.element,"pointer-events"),precision:a.data(this.element,"precision"),relativeInput:a.data(this.element,"relative-input"),clipRelativeInput:a.data(this.element,"clip-relative-input"),hoverOnly:a.data(this.element,"hover-only"),inputElement:document.querySelector(a.data(this.element,"input-element")),selector:a.data(this.element,"selector")};for(var s in o)null===o[s]&&delete o[s];r(this,l,o,i),this.inputElement||(this.inputElement=this.element),this.calibrationTimer=null,this.calibrationFlag=!0,this.enabled=!1,this.depthsX=[],this.depthsY=[],this.raf=null,this.bounds=null,this.elementPositionX=0,this.elementPositionY=0,this.elementWidth=0,this.elementHeight=0,this.elementCenterX=0,this.elementCenterY=0,this.elementRangeX=0,this.elementRangeY=0,this.calibrationX=0,this.calibrationY=0,this.inputX=0,this.inputY=0,this.motionX=0,this.motionY=0,this.velocityX=0,this.velocityY=0,this.onMouseMove=this.onMouseMove.bind(this),this.onDeviceOrientation=this.onDeviceOrientation.bind(this),this.onDeviceMotion=this.onDeviceMotion.bind(this),this.onOrientationTimer=this.onOrientationTimer.bind(this),this.onMotionTimer=this.onMotionTimer.bind(this),this.onCalibrationTimer=this.onCalibrationTimer.bind(this),this.onAnimationFrame=this.onAnimationFrame.bind(this),this.onWindowResize=this.onWindowResize.bind(this),this.windowWidth=null,this.windowHeight=null,this.windowCenterX=null,this.windowCenterY=null,this.windowRadiusX=null,this.windowRadiusY=null,this.portrait=!1,this.desktop=!navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i),this.motionSupport=!!window.DeviceMotionEvent&&!this.desktop,this.orientationSupport=!!window.DeviceOrientationEvent&&!this.desktop,this.orientationStatus=0,this.motionStatus=0,this.initialise()}return o(t,[{key:"initialise",value:function(){void 0===this.transform2DSupport&&(this.transform2DSupport=a.transformSupport("2D"),this.transform3DSupport=a.transformSupport("3D")),this.transform3DSupport&&a.accelerate(this.element),"static"===window.getComputedStyle(this.element).getPropertyValue("position")&&(this.element.style.position="relative"),this.pointerEvents||(this.element.style.pointerEvents="none"),this.updateLayers(),this.updateDimensions(),this.enable(),this.queueCalibration(this.calibrationDelay)}},{key:"doReadyCallback",value:function(){this.onReady&&this.onReady()}},{key:"updateLayers",value:function(){this.selector?this.layers=this.element.querySelectorAll(this.selector):this.layers=this.element.children,this.layers.length||console.warn("ParallaxJS: Your scene does not have any layers."),this.depthsX=[],this.depthsY=[];for(var t=0;t<this.layers.length;t++){var e=this.layers[t];this.transform3DSupport&&a.accelerate(e),e.style.position=t?"absolute":"relative",e.style.display="block",e.style.left=0,e.style.top=0;var i=a.data(e,"depth")||0;this.depthsX.push(a.data(e,"depth-x")||i),this.depthsY.push(a.data(e,"depth-y")||i)}}},{key:"updateDimensions",value:function(){this.windowWidth=window.innerWidth,this.windowHeight=window.innerHeight,this.windowCenterX=this.windowWidth*this.originX,this.windowCenterY=this.windowHeight*this.originY,this.windowRadiusX=Math.max(this.windowCenterX,this.windowWidth-this.windowCenterX),this.windowRadiusY=Math.max(this.windowCenterY,this.windowHeight-this.windowCenterY)}},{key:"updateBounds",value:function(){this.bounds=this.inputElement.getBoundingClientRect(),this.elementPositionX=this.bounds.left,this.elementPositionY=this.bounds.top,this.elementWidth=this.bounds.width,this.elementHeight=this.bounds.height,this.elementCenterX=this.elementWidth*this.originX,this.elementCenterY=this.elementHeight*this.originY,this.elementRangeX=Math.max(this.elementCenterX,this.elementWidth-this.elementCenterX),this.elementRangeY=Math.max(this.elementCenterY,this.elementHeight-this.elementCenterY)}},{key:"queueCalibration",value:function(t){clearTimeout(this.calibrationTimer),this.calibrationTimer=setTimeout(this.onCalibrationTimer,t)}},{key:"enable",value:function(){this.enabled||(this.enabled=!0,this.orientationSupport?(this.portrait=!1,window.addEventListener("deviceorientation",this.onDeviceOrientation),this.detectionTimer=setTimeout(this.onOrientationTimer,this.supportDelay)):this.motionSupport?(this.portrait=!1,window.addEventListener("devicemotion",this.onDeviceMotion),this.detectionTimer=setTimeout(this.onMotionTimer,this.supportDelay)):(this.calibrationX=0,this.calibrationY=0,this.portrait=!1,window.addEventListener("mousemove",this.onMouseMove),this.doReadyCallback()),window.addEventListener("resize",this.onWindowResize),this.raf=s(this.onAnimationFrame))}},{key:"disable",value:function(){this.enabled&&(this.enabled=!1,this.orientationSupport?window.removeEventListener("deviceorientation",this.onDeviceOrientation):this.motionSupport?window.removeEventListener("devicemotion",this.onDeviceMotion):window.removeEventListener("mousemove",this.onMouseMove),window.removeEventListener("resize",this.onWindowResize),s.cancel(this.raf))}},{key:"calibrate",value:function(t,e){this.calibrateX=void 0===t?this.calibrateX:t,this.calibrateY=void 0===e?this.calibrateY:e}},{key:"invert",value:function(t,e){this.invertX=void 0===t?this.invertX:t,this.invertY=void 0===e?this.invertY:e}},{key:"friction",value:function(t,e){this.frictionX=void 0===t?this.frictionX:t,this.frictionY=void 0===e?this.frictionY:e}},{key:"scalar",value:function(t,e){this.scalarX=void 0===t?this.scalarX:t,this.scalarY=void 0===e?this.scalarY:e}},{key:"limit",value:function(t,e){this.limitX=void 0===t?this.limitX:t,this.limitY=void 0===e?this.limitY:e}},{key:"origin",value:function(t,e){this.originX=void 0===t?this.originX:t,this.originY=void 0===e?this.originY:e}},{key:"setInputElement",value:function(t){this.inputElement=t,this.updateDimensions()}},{key:"setPosition",value:function(t,e,i){e=e.toFixed(this.precision)+"px",i=i.toFixed(this.precision)+"px",this.transform3DSupport?a.css(t,"transform","translate3d("+e+","+i+",0)"):this.transform2DSupport?a.css(t,"transform","translate("+e+","+i+")"):(t.style.left=e,t.style.top=i)}},{key:"onOrientationTimer",value:function(){this.orientationSupport&&0===this.orientationStatus?(this.disable(),this.orientationSupport=!1,this.enable()):this.doReadyCallback()}},{key:"onMotionTimer",value:function(){this.motionSupport&&0===this.motionStatus?(this.disable(),this.motionSupport=!1,this.enable()):this.doReadyCallback()}},{key:"onCalibrationTimer",value:function(){this.calibrationFlag=!0}},{key:"onWindowResize",value:function(){this.updateDimensions()}},{key:"onAnimationFrame",value:function(){this.updateBounds();var t=this.inputX-this.calibrationX,e=this.inputY-this.calibrationY;(Math.abs(t)>this.calibrationThreshold||Math.abs(e)>this.calibrationThreshold)&&this.queueCalibration(0),this.portrait?(this.motionX=this.calibrateX?e:this.inputY,this.motionY=this.calibrateY?t:this.inputX):(this.motionX=this.calibrateX?t:this.inputX,this.motionY=this.calibrateY?e:this.inputY),this.motionX*=this.elementWidth*(this.scalarX/100),this.motionY*=this.elementHeight*(this.scalarY/100),isNaN(parseFloat(this.limitX))||(this.motionX=a.clamp(this.motionX,-this.limitX,this.limitX)),isNaN(parseFloat(this.limitY))||(this.motionY=a.clamp(this.motionY,-this.limitY,this.limitY)),this.velocityX+=(this.motionX-this.velocityX)*this.frictionX,this.velocityY+=(this.motionY-this.velocityY)*this.frictionY;for(var i=0;i<this.layers.length;i++){var n=this.layers[i],o=this.depthsX[i],r=this.depthsY[i],l=this.velocityX*(o*(this.invertX?-1:1)),h=this.velocityY*(r*(this.invertY?-1:1));this.setPosition(n,l,h)}this.raf=s(this.onAnimationFrame)}},{key:"rotate",value:function(t,e){var i=(t||0)/30,n=(e||0)/30,o=this.windowHeight>this.windowWidth;this.portrait!==o&&(this.portrait=o,this.calibrationFlag=!0),this.calibrationFlag&&(this.calibrationFlag=!1,this.calibrationX=i,this.calibrationY=n),this.inputX=i,this.inputY=n}},{key:"onDeviceOrientation",value:function(t){var e=t.beta,i=t.gamma;null!==e&&null!==i&&(this.orientationStatus=1,this.rotate(e,i))}},{key:"onDeviceMotion",value:function(t){var e=t.rotationRate.beta,i=t.rotationRate.gamma;null!==e&&null!==i&&(this.motionStatus=1,this.rotate(e,i))}},{key:"onMouseMove",value:function(t){var e=t.clientX,i=t.clientY;if(this.hoverOnly&&(e<this.elementPositionX||e>this.elementPositionX+this.elementWidth||i<this.elementPositionY||i>this.elementPositionY+this.elementHeight))return this.inputX=0,void(this.inputY=0);this.relativeInput?(this.clipRelativeInput&&(e=Math.max(e,this.elementPositionX),e=Math.min(e,this.elementPositionX+this.elementWidth),i=Math.max(i,this.elementPositionY),i=Math.min(i,this.elementPositionY+this.elementHeight)),this.elementRangeX&&this.elementRangeY&&(this.inputX=(e-this.elementPositionX-this.elementCenterX)/this.elementRangeX,this.inputY=(i-this.elementPositionY-this.elementCenterY)/this.elementRangeY)):this.windowRadiusX&&this.windowRadiusY&&(this.inputX=(e-this.windowCenterX)/this.windowRadiusX,this.inputY=(i-this.windowCenterY)/this.windowRadiusY)}},{key:"destroy",value:function(){this.disable(),clearTimeout(this.calibrationTimer),clearTimeout(this.detectionTimer),this.element.removeAttribute("style");for(var t=0;t<this.layers.length;t++)this.layers[t].removeAttribute("style");delete this.element,delete this.layers}},{key:"version",value:function(){return"3.1.0"}}]),t}();e.exports=h},{"object-assign":1,raf:4}]},{},[5])(5)});
//# sourceMappingURL=parallax.min.js.map
/*! ScrollMagic v2.0.8 | (c) 2020 Jan Paepke (@janpaepke) | license & info: http://scrollmagic.io */
!function(e,t){"function"==typeof define&&define.amd?define(t):"object"==typeof exports?module.exports=t():e.ScrollMagic=t()}(this,function(){"use strict";function _(){}_.version="2.0.8","undefined"!=typeof window&&window.addEventListener("mousewheel",void 0);var P="data-scrollmagic-pin-spacer";_.Controller=function(e){function t(){var e,t,n;v&&u&&(e=R.type.Array(u)?u:f.slice(0),u=!1,t=d,0!=(n=(d=l.scrollPos())-t)&&(h=0<n?"FORWARD":i),h===i&&e.reverse(),e.forEach(function(e,t){e.update(!0)}))}function r(){n=R.rAF(t)}var n,o,i="REVERSE",s="PAUSED",a=z.defaults,l=this,c=R.extend({},a,e),f=[],u=!1,d=0,h=s,p=!0,g=0,v=!0,m=function(){0<c.refreshInterval&&(o=window.setTimeout(E,c.refreshInterval))},w=function(){return c.vertical?R.get.scrollTop(c.container):R.get.scrollLeft(c.container)},y=function(){return c.vertical?R.get.height(c.container):R.get.width(c.container)},S=this._setScrollPos=function(e){c.vertical?p?window.scrollTo(R.get.scrollLeft(),e):c.container.scrollTop=e:p?window.scrollTo(e,R.get.scrollTop()):c.container.scrollLeft=e},b=function(e){"resize"==e.type&&(g=y(),h=s),!0!==u&&(u=!0,r())},E=function(){if(!p&&g!=y()){var t;try{t=new Event("resize",{bubbles:!1,cancelable:!1})}catch(e){(t=document.createEvent("Event")).initEvent("resize",!1,!1)}c.container.dispatchEvent(t)}f.forEach(function(e,t){e.refresh()}),m()};this._options=c;function x(e){if(e.length<=1)return e;var t=e.slice(0);return t.sort(function(e,t){return e.scrollOffset()>t.scrollOffset()?1:-1}),t}return this.addScene=function(e){if(R.type.Array(e))e.forEach(function(e,t){l.addScene(e)});else if(e instanceof _.Scene)if(e.controller()!==l)e.addTo(l);else if(!~f.indexOf(e))for(var t in f.push(e),f=x(f),e.on("shift.controller_sort",function(){f=x(f)}),c.globalSceneOptions)e[t]&&e[t].call(e,c.globalSceneOptions[t]);return l},this.removeScene=function(e){var t;return R.type.Array(e)?e.forEach(function(e,t){l.removeScene(e)}):-1<(t=f.indexOf(e))&&(e.off("shift.controller_sort"),f.splice(t,1),e.remove()),l},this.updateScene=function(e,n){return R.type.Array(e)?e.forEach(function(e,t){l.updateScene(e,n)}):n?e.update(!0):!0!==u&&e instanceof _.Scene&&(~(u=u||[]).indexOf(e)||u.push(e),u=x(u),r()),l},this.update=function(e){return b({type:"resize"}),e&&t(),l},this.scrollTo=function(e,t){if(R.type.Number(e))S.call(c.container,e,t);else if(e instanceof _.Scene)e.controller()===l&&l.scrollTo(e.scrollOffset(),t);else if(R.type.Function(e))S=e;else{var n=R.get.elements(e)[0];if(n){for(;n.parentNode.hasAttribute(P);)n=n.parentNode;var r=c.vertical?"top":"left",o=R.get.offset(c.container),i=R.get.offset(n);p||(o[r]-=l.scrollPos()),l.scrollTo(i[r]-o[r],t)}}return l},this.scrollPos=function(e){return arguments.length?(R.type.Function(e)&&(w=e),l):w.call(l)},this.info=function(e){var t={size:g,vertical:c.vertical,scrollPos:d,scrollDirection:h,container:c.container,isDocument:p};return arguments.length?void 0!==t[e]?t[e]:void 0:t},this.loglevel=function(e){return l},this.enabled=function(e){return arguments.length?(v!=e&&(v=!!e,l.updateScene(f,!0)),l):v},this.destroy=function(e){window.clearTimeout(o);for(var t=f.length;t--;)f[t].destroy(e);return c.container.removeEventListener("resize",b),c.container.removeEventListener("scroll",b),R.cAF(n),null},function(){for(var e in c)a.hasOwnProperty(e)||delete c[e];if(c.container=R.get.elements(c.container)[0],!c.container)throw"ScrollMagic.Controller init failed.";(p=c.container===window||c.container===document.body||!document.body.contains(c.container))&&(c.container=window),g=y(),c.container.addEventListener("resize",b),c.container.addEventListener("scroll",b);var t=parseInt(c.refreshInterval,10);c.refreshInterval=R.type.Number(t)?t:a.refreshInterval,m()}(),l};var z={defaults:{container:window,vertical:!0,globalSceneOptions:{},loglevel:2,refreshInterval:100}};_.Controller.addOption=function(e,t){z.defaults[e]=t},_.Controller.extend=function(e){var t=this;_.Controller=function(){return t.apply(this,arguments),this.$super=R.extend({},this),e.apply(this,arguments)||this},R.extend(_.Controller,t),_.Controller.prototype=t.prototype,_.Controller.prototype.constructor=_.Controller},_.Scene=function(e){var n,l,c="BEFORE",f="DURING",u="AFTER",r=D.defaults,d=this,h=R.extend({},r,e),p=c,g=0,a={start:0,end:0},v=0,o=!0,s={};this.on=function(e,o){return R.type.Function(o)&&(e=e.trim().split(" ")).forEach(function(e){var t=e.split("."),n=t[0],r=t[1];"*"!=n&&(s[n]||(s[n]=[]),s[n].push({namespace:r||"",callback:o}))}),d},this.off=function(e,i){return e&&(e=e.trim().split(" ")).forEach(function(e,t){var n=e.split("."),r=n[0],o=n[1]||"";("*"===r?Object.keys(s):[r]).forEach(function(e){for(var t=s[e]||[],n=t.length;n--;){var r=t[n];!r||o!==r.namespace&&"*"!==o||i&&i!=r.callback||t.splice(n,1)}t.length||delete s[e]})}),d},this.trigger=function(e,n){var t,r,o,i;return e&&(t=e.trim().split("."),r=t[0],o=t[1],(i=s[r])&&i.forEach(function(e,t){o&&o!==e.namespace||e.callback.call(d,new _.Event(r,e.namespace,d,n))})),d},d.on("change.internal",function(e){"loglevel"!==e.what&&"tweenChanges"!==e.what&&("triggerElement"===e.what?y():"reverse"===e.what&&d.update())}).on("shift.internal",function(e){t(),d.update()}),this.addTo=function(e){return e instanceof _.Controller&&l!=e&&(l&&l.removeScene(d),l=e,E(),i(!0),y(!0),t(),l.info("container").addEventListener("resize",S),e.addScene(d),d.trigger("add",{controller:l}),d.update()),d},this.enabled=function(e){return arguments.length?(o!=e&&(o=!!e,d.update(!0)),d):o},this.remove=function(){var e;return l&&(l.info("container").removeEventListener("resize",S),e=l,l=void 0,e.removeScene(d),d.trigger("remove")),d},this.destroy=function(e){return d.trigger("destroy",{reset:e}),d.remove(),d.off("*.*"),null},this.update=function(e){var t,n;return l&&(e?l.enabled()&&o?(t=l.info("scrollPos"),n=0<h.duration?(t-a.start)/(a.end-a.start):t>=a.start?1:0,d.trigger("update",{startPos:a.start,endPos:a.end,scrollPos:t}),d.progress(n)):m&&p===f&&T(!0):l.updateScene(d,!1)),d},this.refresh=function(){return i(),y(),d},this.progress=function(e){if(arguments.length){var t,n,r,o=!1,i=p,s=l?l.info("scrollDirection"):"PAUSED",a=h.reverse||g<=e;return 0===h.duration?(o=g!=e,p=0===(g=e<1&&a?0:1)?c:f):e<0&&p!==c&&a?(p=c,o=!(g=0)):0<=e&&e<1&&a?(g=e,p=f,o=!0):1<=e&&p!==u?(g=1,p=u,o=!0):p!==f||a||T(),o&&(t={progress:g,state:p,scrollDirection:s},r=function(e){d.trigger(e,t)},(n=p!=i)&&i!==f&&(r("enter"),r(i===c?"start":"end")),r("progress"),n&&p!==f&&(r(p===c?"start":"end"),r("leave"))),d}return g};var m,w,t=function(){a={start:v+h.offset},l&&h.triggerElement&&(a.start-=l.info("size")*h.triggerHook),a.end=a.start+h.duration},i=function(e){var t;!n||x(t="duration",n.call(d))&&!e&&(d.trigger("change",{what:t,newval:h[t]}),d.trigger("shift",{reason:t}))},y=function(e){var t=0,n=h.triggerElement;if(l&&(n||0<v)){if(n)if(n.parentNode){for(var r=l.info(),o=R.get.offset(r.container),i=r.vertical?"top":"left";n.parentNode.hasAttribute(P);)n=n.parentNode;var s=R.get.offset(n);r.isDocument||(o[i]-=l.scrollPos()),t=s[i]-o[i]}else d.triggerElement(void 0);var a=t!=v;v=t,a&&!e&&d.trigger("shift",{reason:"triggerElementPosition"})}},S=function(e){0<h.triggerHook&&d.trigger("shift",{reason:"containerResize"})},b=R.extend(D.validate,{duration:function(t){var e;if(R.type.String(t)&&t.match(/^(\.|\d)*\d+%$/)&&(e=parseFloat(t)/100,t=function(){return l?l.info("size")*e:0}),R.type.Function(t)){n=t;try{t=parseFloat(n.call(d))}catch(e){t=-1}}if(t=parseFloat(t),!R.type.Number(t)||t<0)throw n=n&&void 0,0;return t}}),E=function(e){(e=arguments.length?[e]:Object.keys(b)).forEach(function(t,e){var n;if(b[t])try{n=b[t](h[t])}catch(e){n=r[t]}finally{h[t]=n}})},x=function(e,t){var n=!1,r=h[e];return h[e]!=t&&(h[e]=t,E(e),n=r!=h[e]),n},z=function(t){d[t]||(d[t]=function(e){return arguments.length?("duration"===t&&(n=void 0),x(t,e)&&(d.trigger("change",{what:t,newval:h[t]}),~D.shifts.indexOf(t)&&d.trigger("shift",{reason:t})),d):h[t]})};this.controller=function(){return l},this.state=function(){return p},this.scrollOffset=function(){return a.start},this.triggerPosition=function(){var e=h.offset;return l&&(h.triggerElement?e+=v:e+=l.info("size")*d.triggerHook()),e},d.on("shift.internal",function(e){var t="duration"===e.reason;(p===u&&t||p===f&&0===h.duration)&&T(),t&&A()}).on("progress.internal",function(e){T()}).on("add.internal",function(e){A()}).on("destroy.internal",function(e){d.removePin(e.reset)});function C(){l&&m&&p===f&&!l.info("isDocument")&&T()}function F(){l&&m&&p===f&&((w.relSize.width||w.relSize.autoFullWidth)&&R.get.width(window)!=R.get.width(w.spacer.parentNode)||w.relSize.height&&R.get.height(window)!=R.get.height(w.spacer.parentNode))&&A()}function L(e){l&&m&&p===f&&!l.info("isDocument")&&(e.preventDefault(),l._setScrollPos(l.info("scrollPos")-((e.wheelDelta||e[l.info("vertical")?"wheelDeltaY":"wheelDeltaX"])/3||30*-e.detail)))}var T=function(e){var t,n,r,o,i,s;m&&l&&(t=l.info(),n=w.spacer.firstChild,e||p!==f?(r={position:w.inFlow?"relative":"absolute",top:0,left:0},o=R.css(n,"position")!=r.position,w.pushFollowers?0<h.duration&&(p===u&&0===parseFloat(R.css(w.spacer,"padding-top"))||p===c&&0===parseFloat(R.css(w.spacer,"padding-bottom")))&&(o=!0):r[t.vertical?"top":"left"]=h.duration*g,R.css(n,r),o&&A()):("fixed"!=R.css(n,"position")&&(R.css(n,{position:"fixed"}),A()),i=R.get.offset(w.spacer,!0),s=h.reverse||0===h.duration?t.scrollPos-a.start:Math.round(g*h.duration*10)/10,i[t.vertical?"top":"left"]+=s,R.css(w.spacer.firstChild,{top:i.top,left:i.left})))},A=function(){var e,t,n,r,o;m&&l&&w.inFlow&&(e=p===f,t=l.info("vertical"),n=w.spacer.firstChild,r=R.isMarginCollapseType(R.css(w.spacer,"display")),o={},w.relSize.width||w.relSize.autoFullWidth?e?R.css(m,{width:R.get.width(w.spacer)}):R.css(m,{width:"100%"}):(o["min-width"]=R.get.width(t?m:n,!0,!0),o.width=e?o["min-width"]:"auto"),w.relSize.height?e?R.css(m,{height:R.get.height(w.spacer)-(w.pushFollowers?h.duration:0)}):R.css(m,{height:"100%"}):(o["min-height"]=R.get.height(t?n:m,!0,!r),o.height=e?o["min-height"]:"auto"),w.pushFollowers&&(o["padding"+(t?"Top":"Left")]=h.duration*g,o["padding"+(t?"Bottom":"Right")]=h.duration*(1-g)),R.css(w.spacer,o))};this.setPin=function(e,t){if(t=R.extend({},{pushFollowers:!0,spacerClass:"scrollmagic-pin-spacer"},t),!(e=R.get.elements(e)[0]))return d;if("fixed"===R.css(e,"position"))return d;if(m){if(m===e)return d;d.removePin()}var n=(m=e).parentNode.style.display,r=["top","left","bottom","right","margin","marginLeft","marginRight","marginTop","marginBottom"];m.parentNode.style.display="none";var o="absolute"!=R.css(m,"position"),i=R.css(m,r.concat(["display"])),s=R.css(m,["width","height"]);m.parentNode.style.display=n,!o&&t.pushFollowers&&(t.pushFollowers=!1);var a,l=m.parentNode.insertBefore(document.createElement("div"),m),c=R.extend(i,{position:o?"relative":"absolute",boxSizing:"content-box",mozBoxSizing:"content-box",webkitBoxSizing:"content-box"});return o||R.extend(c,R.css(m,["width","height"])),R.css(l,c),l.setAttribute(P,""),R.addClass(l,t.spacerClass),w={spacer:l,relSize:{width:"%"===s.width.slice(-1),height:"%"===s.height.slice(-1),autoFullWidth:"auto"===s.width&&o&&R.isMarginCollapseType(i.display)},pushFollowers:t.pushFollowers,inFlow:o},m.___origStyle||(m.___origStyle={},a=m.style,r.concat(["width","height","position","boxSizing","mozBoxSizing","webkitBoxSizing"]).forEach(function(e){m.___origStyle[e]=a[e]||""})),w.relSize.width&&R.css(l,{width:s.width}),w.relSize.height&&R.css(l,{height:s.height}),l.appendChild(m),R.css(m,{position:o?"relative":"absolute",margin:"auto",top:"auto",left:"auto",bottom:"auto",right:"auto"}),(w.relSize.width||w.relSize.autoFullWidth)&&R.css(m,{boxSizing:"border-box",mozBoxSizing:"border-box",webkitBoxSizing:"border-box"}),window.addEventListener("scroll",C),window.addEventListener("resize",C),window.addEventListener("resize",F),m.addEventListener("mousewheel",L),m.addEventListener("DOMMouseScroll",L),T(),d},this.removePin=function(e){var t,n,r;return m&&(p===f&&T(!0),!e&&l||((t=w.spacer.firstChild).hasAttribute(P)&&(n=w.spacer.style,r={},["margin","marginLeft","marginRight","marginTop","marginBottom"].forEach(function(e){r[e]=n[e]||""}),R.css(t,r)),w.spacer.parentNode.insertBefore(t,w.spacer),w.spacer.parentNode.removeChild(w.spacer),m.parentNode.hasAttribute(P)||(R.css(m,m.___origStyle),delete m.___origStyle)),window.removeEventListener("scroll",C),window.removeEventListener("resize",C),window.removeEventListener("resize",F),m.removeEventListener("mousewheel",L),m.removeEventListener("DOMMouseScroll",L),m=void 0),d};var N,O=[];return d.on("destroy.internal",function(e){d.removeClassToggle(e.reset)}),this.setClassToggle=function(e,t){var n=R.get.elements(e);return 0!==n.length&&R.type.String(t)&&(0<O.length&&d.removeClassToggle(),N=t,O=n,d.on("enter.internal_class leave.internal_class",function(e){var n="enter"===e.type?R.addClass:R.removeClass;O.forEach(function(e,t){n(e,N)})})),d},this.removeClassToggle=function(e){return e&&O.forEach(function(e,t){R.removeClass(e,N)}),d.off("start.internal_class end.internal_class"),N=void 0,O=[],d},function(){for(var e in h)r.hasOwnProperty(e)||delete h[e];for(var t in r)z(t);E()}(),d};var D={defaults:{duration:0,offset:0,triggerElement:void 0,triggerHook:.5,reverse:!0,loglevel:2},validate:{offset:function(e){if(e=parseFloat(e),!R.type.Number(e))throw 0;return e},triggerElement:function(e){if(e=e||void 0){var t=R.get.elements(e)[0];if(!t||!t.parentNode)throw 0;e=t}return e},triggerHook:function(e){var t={onCenter:.5,onEnter:1,onLeave:0};if(R.type.Number(e))e=Math.max(0,Math.min(parseFloat(e),1));else{if(!(e in t))throw 0;e=t[e]}return e},reverse:function(e){return!!e}},shifts:["duration","offset","triggerHook"]};_.Scene.addOption=function(e,t,n,r){e in D.defaults||(D.defaults[e]=t,D.validate[e]=n,r&&D.shifts.push(e))},_.Scene.extend=function(e){var t=this;_.Scene=function(){return t.apply(this,arguments),this.$super=R.extend({},this),e.apply(this,arguments)||this},R.extend(_.Scene,t),_.Scene.prototype=t.prototype,_.Scene.prototype.constructor=_.Scene},_.Event=function(e,t,n,r){for(var o in r=r||{})this[o]=r[o];return this.type=e,this.target=this.currentTarget=n,this.namespace=t||"",this.timeStamp=this.timestamp=Date.now(),this};var R=_._util=function(s){function a(e){return parseFloat(e)||0}function l(e){return e.currentStyle?e.currentStyle:s.getComputedStyle(e)}function r(e,t,n,r){if((t=t===document?s:t)===s)r=!1;else if(!u.DomElement(t))return 0;e=e[0].toUpperCase()+e.substr(1).toLowerCase();var o,i=(n?t["offset"+e]||t["outer"+e]:t["client"+e]||t["inner"+e])||0;return n&&r&&(o=l(t),i+="Height"===e?a(o.marginTop)+a(o.marginBottom):a(o.marginLeft)+a(o.marginRight)),i}function c(e){return e.replace(/^[^a-z]+([a-z])/g,"$1").replace(/-([a-z])/g,function(e){return e[1].toUpperCase()})}var e={};e.extend=function(e){for(e=e||{},f=1;f<arguments.length;f++)if(arguments[f])for(var t in arguments[f])arguments[f].hasOwnProperty(t)&&(e[t]=arguments[f][t]);return e},e.isMarginCollapseType=function(e){return!!~["block","flex","list-item","table","-webkit-box"].indexOf(e)};for(var o=0,t=["ms","moz","webkit","o"],n=s.requestAnimationFrame,i=s.cancelAnimationFrame,f=0;!n&&f<4;++f)n=s[t[f]+"RequestAnimationFrame"],i=s[t[f]+"CancelAnimationFrame"]||s[t[f]+"CancelRequestAnimationFrame"];n=n||function(e){var t=(new Date).getTime(),n=Math.max(0,16-(t-o)),r=s.setTimeout(function(){e(t+n)},n);return o=t+n,r},i=i||function(e){s.clearTimeout(e)},e.rAF=n.bind(s),e.cAF=i.bind(s);var u=e.type=function(e){return Object.prototype.toString.call(e).replace(/^\[object (.+)\]$/,"$1").toLowerCase()};u.String=function(e){return"string"===u(e)},u.Function=function(e){return"function"===u(e)},u.Array=function(e){return Array.isArray(e)},u.Number=function(e){return!u.Array(e)&&0<=e-parseFloat(e)+1},u.DomElement=function(e){return"object"==typeof HTMLElement||"function"==typeof HTMLElement?e instanceof HTMLElement||e instanceof SVGElement:e&&"object"==typeof e&&null!==e&&1===e.nodeType&&"string"==typeof e.nodeName};var d=e.get={};return d.elements=function(e){var t=[];if(u.String(e))try{e=document.querySelectorAll(e)}catch(e){return t}if("nodelist"===u(e)||u.Array(e)||e instanceof NodeList)for(var n=0,r=t.length=e.length;n<r;n++){var o=e[n];t[n]=u.DomElement(o)?o:d.elements(o)}else!u.DomElement(e)&&e!==document&&e!==s||(t=[e]);return t},d.scrollTop=function(e){return e&&"number"==typeof e.scrollTop?e.scrollTop:s.pageYOffset||0},d.scrollLeft=function(e){return e&&"number"==typeof e.scrollLeft?e.scrollLeft:s.pageXOffset||0},d.width=function(e,t,n){return r("width",e,t,n)},d.height=function(e,t,n){return r("height",e,t,n)},d.offset=function(e,t){var n,r={top:0,left:0};return e&&e.getBoundingClientRect&&(n=e.getBoundingClientRect(),r.top=n.top,r.left=n.left,t||(r.top+=d.scrollTop(),r.left+=d.scrollLeft())),r},e.addClass=function(e,t){t&&(e.classList?e.classList.add(t):e.className+=" "+t)},e.removeClass=function(e,t){t&&(e.classList?e.classList.remove(t):e.className=e.className.replace(RegExp("(^|\\b)"+t.split(" ").join("|")+"(\\b|$)","gi")," "))},e.css=function(e,t){if(u.String(t))return l(e)[c(t)];if(u.Array(t)){var n={},r=l(e);return t.forEach(function(e,t){n[e]=r[c(e)]}),n}for(var o in t){var i=t[o];i==parseFloat(i)&&(i+="px"),e.style[c(o)]=i}},e}(window||{});return _});
/*!  ScrollMagic v2.0.8 | (c) 2020 Jan Paepke (@janpaepke) | license & info: http://scrollmagic.io */
!function(e,n){var r;"function"==typeof define&&define.amd?define(["ScrollMagic","gsap","TweenMax","TimelineMax"],n):"object"==typeof exports?(r=require("gsap/dist/gsap")||require("gsap"),n(require("scrollmagic"),r,TweenMax||r,TimelineMax||r)):n(e.ScrollMagic||e.jQuery&&e.jQuery.ScrollMagic,e.gsap,e.gsap||e.TweenMax||e.TweenLite,e.gsap||e.TimelineMax||e.TimelineLite)}(this,function(e,n,p,u){"use strict";var g=n&&3<=parseFloat(n.version);e.Scene.addOption("tweenChanges",!1,function(e){return!!e}),e.Scene.extend(function(){var o,i=this;i.on("progress.plugin_gsap",function(){s()}),i.on("destroy.plugin_gsap",function(e){i.removeTween(e.reset)});var s=function(){var e,n;o&&(e=i.progress(),n=i.state(),o.repeat&&-1===o.repeat()?"DURING"===n&&o.paused()?o.play():"DURING"===n||o.paused()||o.pause():e!=o.progress()&&(0===i.duration()?0<e?o.play():o.reverse():i.tweenChanges()&&o.tweenTo?o.tweenTo(e*o.duration()):o.progress(e).pause()))};i.setTween=function(e,n,r){var t,a;1<arguments.length&&(a="number"==typeof arguments[1],g?(a||(r=n),r.hasOwnProperty("duration")||(r.duration=a?n:1)):arguments.length<3&&(r=n,n=1),e=g?p.to(e,r):p.to(e,n,r));try{(t=u&&!g?new u({smoothChildTiming:!0}).add(e):e).pause()}catch(e){return i}return o&&i.removeTween(),o=t,e.repeat&&-1===e.repeat()&&(o.repeat(-1),o.yoyo(e.yoyo())),s(),i},i.removeTween=function(e){return o&&(e&&o.progress(0).pause(),o.kill(),o=void 0),i}})});
 /*! ScrollMagic v2.0.8 | (c) 2020 Jan Paepke (@janpaepke) | license & info: http://scrollmagic.io */
!function(e,i){"function"==typeof define&&define.amd?define(["ScrollMagic","velocity"],i):"object"==typeof exports?i(require("scrollmagic"),require("velocity")):i(e.ScrollMagic||e.jQuery&&e.jQuery.ScrollMagic,e.Velocity||e.jQuery&&e.jQuery.Velocity)}(this,function(e,y){"use strict";var v=0;e.Scene.extend(function(){var o,r,u,n,c=this,l=e._util,i=0;c.on("progress.plugin_velocity",function(){f()}),c.on("destroy.plugin_velocity",function(e){c.off("*.plugin_velocity"),c.removeVelocity(e.reset)});var s=function(e,i,t){l.type.Array(e)?e.forEach(function(e){s(e,i,t)}):(y.Utilities.data(e,n)||y.Utilities.data(e,n,{reverseProps:l.css(e,Object.keys(r))}),y(e,i,t),void 0!==t.queue&&y.Utilities.dequeue(e,t.queue))},a=function(e,i){var t;l.type.Array(e)?e.forEach(function(e){a(e,i)}):(t=y.Utilities.data(e,n))&&t.reverseProps&&(y(e,t.reverseProps,i),void 0!==i.queue&&y.Utilities.dequeue(e,i.queue))},f=function(){var e;!o||(e=c.progress())!=i&&(0===c.duration()&&(0<e?s(o,r,u):a(o,u)),i=e)};c.setVelocity=function(e,i,t){return o&&c.removeVelocity(),o=l.get.elements(e),r=i||{},n="ScrollMagic.animation.velocity["+v+++"]",void 0!==(u=t||{}).queue&&(u.queue=n+"_queue"),f(),c},c.removeVelocity=function(e){return o&&(void 0!==u.queue&&y(o,"stop",u.queue),e&&a(o,{duration:0}),o.forEach(function(e){y.Utilities.removeData(e,n)}),o=r=u=n=void 0),c}})});
/*! ScrollMagic v2.0.8 | (c) 2020 Jan Paepke (@janpaepke) | license & info: http://scrollmagic.io */
!function(e,r){"function"==typeof define&&define.amd?define(["ScrollMagic"],r):"object"==typeof exports?r(require("scrollmagic")):r(e.ScrollMagic||e.jQuery&&e.jQuery.ScrollMagic)}(this,function(i){"use strict";var o="0.85em",n="9999",v=i._util,h=0;i.Scene.extend(function(){var t,i=this;i.addIndicators=function(e){var r;return t||(r={name:"",indent:0,parent:void 0,colorStart:"green",colorEnd:"red",colorTrigger:"blue"},e=v.extend({},r,e),h++,t=new s(i,e),i.on("add.plugin_addIndicators",t.add),i.on("remove.plugin_addIndicators",t.remove),i.on("destroy.plugin_addIndicators",i.removeIndicators),i.controller()&&t.add()),i},i.removeIndicators=function(){return t&&(t.remove(),this.off("*.plugin_addIndicators"),t=void 0),i}}),i.Controller.addOption("addIndicators",!1),i.Controller.extend(function(){var c=this,e=c.info(),l=e.container,f=e.isDocument,m=e.vertical,h={groups:[]};this._indicators=h;function r(){h.updateBoundsPositions()}function t(){h.updateTriggerGroupPositions()}return l.addEventListener("resize",t),f||(window.addEventListener("resize",t),window.addEventListener("scroll",t)),l.addEventListener("resize",r),l.addEventListener("scroll",r),this._indicators.updateBoundsPositions=function(e){for(var r,t,i,o=e?[v.extend({},e.triggerGroup,{members:[e]})]:h.groups,n=o.length,s={},d=m?"left":"top",a=m?"width":"height",g=m?v.get.scrollLeft(l)+v.get.width(l)-15:v.get.scrollTop(l)+v.get.height(l)-15;n--;)for(r=(i=o[n]).members.length,t=v.get[a](i.element.firstChild);r--;)s[d]=g-t,v.css(i.members[r].bounds,s)},this._indicators.updateTriggerGroupPositions=function(e){for(var r,t,i,o,n=e?[e]:h.groups,s=n.length,d=f?document.body:l,a=f?{top:0,left:0}:v.get.offset(d,!0),g=m?v.get.width(l)-15:v.get.height(l)-15,p=m?"width":"height",u=m?"Y":"X";s--;)t=(r=n[s]).element,i=r.triggerHook*c.info("size"),o=v.get[p](t.firstChild.firstChild)<i?"translate"+u+"(-100%)":"",v.css(t,{top:a.top+(m?i:g-r.members[0].options.indent),left:a.left+(m?g-r.members[0].options.indent:i)}),v.css(t.firstChild.firstChild,{"-ms-transform":o,"-webkit-transform":o,transform:o})},this._indicators.updateTriggerGroupLabel=function(e){var r="trigger"+(1<e.members.length?"":" "+e.members[0].options.name),t=e.element.firstChild.firstChild;t.textContent!==r&&(t.textContent=r,m&&h.updateBoundsPositions())},this.addScene=function(e){this._options.addIndicators&&e instanceof i.Scene&&e.controller()===c&&e.addIndicators(),this.$super.addScene.apply(this,arguments)},this.destroy=function(){l.removeEventListener("resize",t),f||(window.removeEventListener("resize",t),window.removeEventListener("scroll",t)),l.removeEventListener("resize",r),l.removeEventListener("scroll",r),this.$super.destroy.apply(this,arguments)},c});var s=function(o,n){var s,d,a=this,t=b.bounds(),i=b.start(n.colorStart),g=b.end(n.colorEnd),p=n.parent&&v.get.elements(n.parent)[0];n.name=n.name||h,i.firstChild.textContent+=" "+n.name,g.textContent+=" "+n.name,t.appendChild(i),t.appendChild(g),a.options=n,a.bounds=t,a.triggerGroup=void 0,this.add=function(){d=o.controller(),s=d.info("vertical");var e=d.info("isDocument");p=p||(e?document.body:d.info("container")),e||"static"!==v.css(p,"position")||v.css(p,{position:"relative"}),o.on("change.plugin_addIndicators",u),o.on("shift.plugin_addIndicators",r),m(),l(),setTimeout(function(){d._indicators.updateBoundsPositions(a)},0)},this.remove=function(){var e;a.triggerGroup&&(o.off("change.plugin_addIndicators",u),o.off("shift.plugin_addIndicators",r),1<a.triggerGroup.members.length?((e=a.triggerGroup).members.splice(e.members.indexOf(a),1),d._indicators.updateTriggerGroupLabel(e),d._indicators.updateTriggerGroupPositions(e),a.triggerGroup=void 0):f(),c())};var r=function(){l()},u=function(e){"triggerHook"===e.what&&m()},c=function(){t.parentNode.removeChild(t)},l=function(){var e;t.parentNode!==p&&(e=d.info("vertical"),v.css(i.firstChild,{"border-bottom-width":e?1:0,"border-right-width":e?0:1,bottom:e?-1:n.indent,right:e?n.indent:-1,padding:e?"0 8px":"2px 4px"}),v.css(g,{"border-top-width":e?1:0,"border-left-width":e?0:1,top:e?"100%":"",right:e?n.indent:"",bottom:e?"":n.indent,left:e?"":"100%",padding:e?"0 8px":"2px 4px"}),p.appendChild(t));var r={};r[s?"top":"left"]=o.triggerPosition(),r[s?"height":"width"]=o.duration(),v.css(t,r),v.css(g,{display:0<o.duration()?"":"none"})},f=function(){d._indicators.groups.splice(d._indicators.groups.indexOf(a.triggerGroup),1),a.triggerGroup.element.parentNode.removeChild(a.triggerGroup.element),a.triggerGroup=void 0},m=function(){var e=o.triggerHook();if(!(a.triggerGroup&&Math.abs(a.triggerGroup.triggerHook-e)<1e-4)){for(var r,t=d._indicators.groups,i=t.length;i--;)if(r=t[i],Math.abs(r.triggerHook-e)<1e-4)return a.triggerGroup&&(1===a.triggerGroup.members.length?f():(a.triggerGroup.members.splice(a.triggerGroup.members.indexOf(a),1),d._indicators.updateTriggerGroupLabel(a.triggerGroup),d._indicators.updateTriggerGroupPositions(a.triggerGroup))),r.members.push(a),a.triggerGroup=r,void d._indicators.updateTriggerGroupLabel(r);if(a.triggerGroup){if(1===a.triggerGroup.members.length)return a.triggerGroup.triggerHook=e,void d._indicators.updateTriggerGroupPositions(a.triggerGroup);a.triggerGroup.members.splice(a.triggerGroup.members.indexOf(a),1),d._indicators.updateTriggerGroupLabel(a.triggerGroup),d._indicators.updateTriggerGroupPositions(a.triggerGroup),a.triggerGroup=void 0}!function(){var e=b.trigger(n.colorTrigger),r={};r[s?"right":"bottom"]=0,r[s?"border-top-width":"border-left-width"]=1,v.css(e.firstChild,r),v.css(e.firstChild.firstChild,{padding:s?"0 8px 3px 8px":"3px 4px"}),document.body.appendChild(e);var t={triggerHook:o.triggerHook(),element:e,members:[a]};d._indicators.groups.push(t),a.triggerGroup=t,d._indicators.updateTriggerGroupLabel(t),d._indicators.updateTriggerGroupPositions(t)}()}}},b={start:function(e){var r=document.createElement("div");r.textContent="start",v.css(r,{position:"absolute",overflow:"visible","border-width":0,"border-style":"solid",color:e,"border-color":e});var t=document.createElement("div");return v.css(t,{position:"absolute",overflow:"visible",width:0,height:0}),t.appendChild(r),t},end:function(e){var r=document.createElement("div");return r.textContent="end",v.css(r,{position:"absolute",overflow:"visible","border-width":0,"border-style":"solid",color:e,"border-color":e}),r},bounds:function(){var e=document.createElement("div");return v.css(e,{position:"absolute",overflow:"visible","white-space":"nowrap","pointer-events":"none","font-size":o}),e.style.zIndex=n,e},trigger:function(e){var r=document.createElement("div");r.textContent="trigger",v.css(r,{position:"relative"});var t=document.createElement("div");v.css(t,{position:"absolute",overflow:"visible","border-width":0,"border-style":"solid",color:e,"border-color":e}),t.appendChild(r);var i=document.createElement("div");return v.css(i,{position:"fixed",overflow:"visible","white-space":"nowrap","pointer-events":"none","font-size":o}),i.style.zIndex=n,i.appendChild(t),i}}});
/*! ScrollMagic v2.0.8 | (c) 2020 Jan Paepke (@janpaepke) | license & info: http://scrollmagic.io */
!function(e,i){"function"==typeof define&&define.amd?define(["ScrollMagic","jquery"],i):"object"==typeof exports?i(require("scrollmagic"),require("jquery")):i(e.ScrollMagic,e.jQuery)}(this,function(e,t){"use strict";e._util.get.elements=function(e){return t(e).toArray()},e._util.addClass=function(e,i){t(e).addClass(i)},e._util.removeClass=function(e,i){t(e).removeClass(i)},t.ScrollMagic=e});
!(function (t, e) {
	"object" == typeof exports && "object" == typeof module
		? (module.exports = e())
		: "function" == typeof define && define.amd
		? define([], e)
		: "object" == typeof exports
		? (exports.Scrollbar = e())
		: (t.Scrollbar = e());
})(this, function () {
	return (function (t) {
		var e = {};
		function n(r) {
			if (e[r]) return e[r].exports;
			var o = (e[r] = { i: r, l: !1, exports: {} });
			return t[r].call(o.exports, o, o.exports, n), (o.l = !0), o.exports;
		}
		return (
			(n.m = t),
			(n.c = e),
			(n.d = function (t, e, r) {
				n.o(t, e) ||
					Object.defineProperty(t, e, { enumerable: !0, get: r });
			}),
			(n.r = function (t) {
				"undefined" != typeof Symbol &&
					Symbol.toStringTag &&
					Object.defineProperty(t, Symbol.toStringTag, {
						value: "Module",
					}),
					Object.defineProperty(t, "__esModule", { value: !0 });
			}),
			(n.t = function (t, e) {
				if ((1 & e && (t = n(t)), 8 & e)) return t;
				if (4 & e && "object" == typeof t && t && t.__esModule)
					return t;
				var r = Object.create(null);
				if (
					(n.r(r),
					Object.defineProperty(r, "default", {
						enumerable: !0,
						value: t,
					}),
					2 & e && "string" != typeof t)
				)
					for (var o in t)
						n.d(
							r,
							o,
							function (e) {
								return t[e];
							}.bind(null, o)
						);
				return r;
			}),
			(n.n = function (t) {
				var e =
					t && t.__esModule
						? function () {
								return t.default;
						  }
						: function () {
								return t;
						  };
				return n.d(e, "a", e), e;
			}),
			(n.o = function (t, e) {
				return Object.prototype.hasOwnProperty.call(t, e);
			}),
			(n.p = ""),
			n((n.s = 65))
		);
	})([
		function (t, e, n) {
			(function (e) {
				var n = function (t) {
					return t && t.Math == Math && t;
				};
				t.exports =
					n("object" == typeof globalThis && globalThis) ||
					n("object" == typeof window && window) ||
					n("object" == typeof self && self) ||
					n("object" == typeof e && e) ||
					Function("return this")();
			}).call(this, n(68));
		},
		function (t, e, n) {
			var r = n(0),
				o = n(50),
				i = n(3),
				u = n(29),
				c = n(55),
				a = n(75),
				s = o("wks"),
				f = r.Symbol,
				l = a ? f : (f && f.withoutSetter) || u;
			t.exports = function (t) {
				return (
					i(s, t) ||
						(c && i(f, t)
							? (s[t] = f[t])
							: (s[t] = l("Symbol." + t))),
					s[t]
				);
			};
		},
		function (t, e) {
			t.exports = function (t) {
				return "object" == typeof t
					? null !== t
					: "function" == typeof t;
			};
		},
		function (t, e) {
			var n = {}.hasOwnProperty;
			t.exports = function (t, e) {
				return n.call(t, e);
			};
		},
		function (t, e) {
			t.exports = function (t) {
				try {
					return !!t();
				} catch (t) {
					return !0;
				}
			};
		},
		function (t, e, n) {
			var r = n(6),
				o = n(45),
				i = n(7),
				u = n(25),
				c = Object.defineProperty;
			e.f = r
				? c
				: function (t, e, n) {
						if ((i(t), (e = u(e, !0)), i(n), o))
							try {
								return c(t, e, n);
							} catch (t) {}
						if ("get" in n || "set" in n)
							throw TypeError("Accessors not supported");
						return "value" in n && (t[e] = n.value), t;
				  };
		},
		function (t, e, n) {
			var r = n(4);
			t.exports = !r(function () {
				return (
					7 !=
					Object.defineProperty({}, 1, {
						get: function () {
							return 7;
						},
					})[1]
				);
			});
		},
		function (t, e, n) {
			var r = n(2);
			t.exports = function (t) {
				if (!r(t)) throw TypeError(String(t) + " is not an object");
				return t;
			};
		},
		function (t, e, n) {
			var r = n(6),
				o = n(5),
				i = n(14);
			t.exports = r
				? function (t, e, n) {
						return o.f(t, e, i(1, n));
				  }
				: function (t, e, n) {
						return (t[e] = n), t;
				  };
		},
		function (t, e, n) {
			var r,
				o,
				i,
				u = n(49),
				c = n(0),
				a = n(2),
				s = n(8),
				f = n(3),
				l = n(27),
				p = n(16),
				h = c.WeakMap;
			if (u) {
				var d = new h(),
					v = d.get,
					y = d.has,
					m = d.set;
				(r = function (t, e) {
					return m.call(d, t, e), e;
				}),
					(o = function (t) {
						return v.call(d, t) || {};
					}),
					(i = function (t) {
						return y.call(d, t);
					});
			} else {
				var g = l("state");
				(p[g] = !0),
					(r = function (t, e) {
						return s(t, g, e), e;
					}),
					(o = function (t) {
						return f(t, g) ? t[g] : {};
					}),
					(i = function (t) {
						return f(t, g);
					});
			}
			t.exports = {
				set: r,
				get: o,
				has: i,
				enforce: function (t) {
					return i(t) ? o(t) : r(t, {});
				},
				getterFor: function (t) {
					return function (e) {
						var n;
						if (!a(e) || (n = o(e)).type !== t)
							throw TypeError(
								"Incompatible receiver, " + t + " required"
							);
						return n;
					};
				},
			};
		},
		function (t, e, n) {
			var r = n(0);
			t.exports = r;
		},
		function (t, e, n) {
			var r = n(0),
				o = n(8),
				i = n(3),
				u = n(26),
				c = n(47),
				a = n(9),
				s = a.get,
				f = a.enforce,
				l = String(String).split("String");
			(t.exports = function (t, e, n, c) {
				var a = !!c && !!c.unsafe,
					s = !!c && !!c.enumerable,
					p = !!c && !!c.noTargetGet;
				"function" == typeof n &&
					("string" != typeof e || i(n, "name") || o(n, "name", e),
					(f(n).source = l.join("string" == typeof e ? e : ""))),
					t !== r
						? (a ? !p && t[e] && (s = !0) : delete t[e],
						  s ? (t[e] = n) : o(t, e, n))
						: s
						? (t[e] = n)
						: u(e, n);
			})(Function.prototype, "toString", function () {
				return ("function" == typeof this && s(this).source) || c(this);
			});
		},
		function (t, e) {
			t.exports = {};
		},
		function (t, e, n) {
			var r = n(0),
				o = n(43).f,
				i = n(8),
				u = n(11),
				c = n(26),
				a = n(69),
				s = n(53);
			t.exports = function (t, e) {
				var n,
					f,
					l,
					p,
					h,
					d = t.target,
					v = t.global,
					y = t.stat;
				if ((n = v ? r : y ? r[d] || c(d, {}) : (r[d] || {}).prototype))
					for (f in e) {
						if (
							((p = e[f]),
							(l = t.noTargetGet
								? (h = o(n, f)) && h.value
								: n[f]),
							!s(v ? f : d + (y ? "." : "#") + f, t.forced) &&
								void 0 !== l)
						) {
							if (typeof p == typeof l) continue;
							a(p, l);
						}
						(t.sham || (l && l.sham)) && i(p, "sham", !0),
							u(n, f, p, t);
					}
			};
		},
		function (t, e) {
			t.exports = function (t, e) {
				return {
					enumerable: !(1 & t),
					configurable: !(2 & t),
					writable: !(4 & t),
					value: e,
				};
			};
		},
		function (t, e, n) {
			var r = n(22),
				o = n(24);
			t.exports = function (t) {
				return r(o(t));
			};
		},
		function (t, e) {
			t.exports = {};
		},
		function (t, e, n) {
			var r = n(31),
				o = Math.min;
			t.exports = function (t) {
				return t > 0 ? o(r(t), 9007199254740991) : 0;
			};
		},
		function (t, e, n) {
			var r = n(16),
				o = n(2),
				i = n(3),
				u = n(5).f,
				c = n(29),
				a = n(74),
				s = c("meta"),
				f = 0,
				l =
					Object.isExtensible ||
					function () {
						return !0;
					},
				p = function (t) {
					u(t, s, { value: { objectID: "O" + ++f, weakData: {} } });
				},
				h = (t.exports = {
					REQUIRED: !1,
					fastKey: function (t, e) {
						if (!o(t))
							return "symbol" == typeof t
								? t
								: ("string" == typeof t ? "S" : "P") + t;
						if (!i(t, s)) {
							if (!l(t)) return "F";
							if (!e) return "E";
							p(t);
						}
						return t[s].objectID;
					},
					getWeakData: function (t, e) {
						if (!i(t, s)) {
							if (!l(t)) return !0;
							if (!e) return !1;
							p(t);
						}
						return t[s].weakData;
					},
					onFreeze: function (t) {
						return a && h.REQUIRED && l(t) && !i(t, s) && p(t), t;
					},
				});
			r[s] = !0;
		},
		function (t, e, n) {
			var r = n(76);
			t.exports = function (t, e, n) {
				if ((r(t), void 0 === e)) return t;
				switch (n) {
					case 0:
						return function () {
							return t.call(e);
						};
					case 1:
						return function (n) {
							return t.call(e, n);
						};
					case 2:
						return function (n, r) {
							return t.call(e, n, r);
						};
					case 3:
						return function (n, r, o) {
							return t.call(e, n, r, o);
						};
				}
				return function () {
					return t.apply(e, arguments);
				};
			};
		},
		function (t, e, n) {
			var r = n(24);
			t.exports = function (t) {
				return Object(r(t));
			};
		},
		function (t, e, n) {
			"use strict";
			var r = n(13),
				o = n(0),
				i = n(53),
				u = n(11),
				c = n(18),
				a = n(33),
				s = n(35),
				f = n(2),
				l = n(4),
				p = n(59),
				h = n(36),
				d = n(77);
			t.exports = function (t, e, n) {
				var v = -1 !== t.indexOf("Map"),
					y = -1 !== t.indexOf("Weak"),
					m = v ? "set" : "add",
					g = o[t],
					x = g && g.prototype,
					b = g,
					w = {},
					S = function (t) {
						var e = x[t];
						u(
							x,
							t,
							"add" == t
								? function (t) {
										return (
											e.call(this, 0 === t ? 0 : t), this
										);
								  }
								: "delete" == t
								? function (t) {
										return (
											!(y && !f(t)) &&
											e.call(this, 0 === t ? 0 : t)
										);
								  }
								: "get" == t
								? function (t) {
										return y && !f(t)
											? void 0
											: e.call(this, 0 === t ? 0 : t);
								  }
								: "has" == t
								? function (t) {
										return (
											!(y && !f(t)) &&
											e.call(this, 0 === t ? 0 : t)
										);
								  }
								: function (t, n) {
										return (
											e.call(this, 0 === t ? 0 : t, n),
											this
										);
								  }
						);
					};
				if (
					i(
						t,
						"function" != typeof g ||
							!(
								y ||
								(x.forEach &&
									!l(function () {
										new g().entries().next();
									}))
							)
					)
				)
					(b = n.getConstructor(e, t, v, m)), (c.REQUIRED = !0);
				else if (i(t, !0)) {
					var _ = new b(),
						E = _[m](y ? {} : -0, 1) != _,
						O = l(function () {
							_.has(1);
						}),
						T = p(function (t) {
							new g(t);
						}),
						A =
							!y &&
							l(function () {
								for (var t = new g(), e = 5; e--; ) t[m](e, e);
								return !t.has(-0);
							});
					T ||
						(((b = e(function (e, n) {
							s(e, b, t);
							var r = d(new g(), e, b);
							return null != n && a(n, r[m], r, v), r;
						})).prototype = x),
						(x.constructor = b)),
						(O || A) && (S("delete"), S("has"), v && S("get")),
						(A || E) && S(m),
						y && x.clear && delete x.clear;
				}
				return (
					(w[t] = b),
					r({ global: !0, forced: b != g }, w),
					h(b, t),
					y || n.setStrong(b, t, v),
					b
				);
			};
		},
		function (t, e, n) {
			var r = n(4),
				o = n(23),
				i = "".split;
			t.exports = r(function () {
				return !Object("z").propertyIsEnumerable(0);
			})
				? function (t) {
						return "String" == o(t) ? i.call(t, "") : Object(t);
				  }
				: Object;
		},
		function (t, e) {
			var n = {}.toString;
			t.exports = function (t) {
				return n.call(t).slice(8, -1);
			};
		},
		function (t, e) {
			t.exports = function (t) {
				if (null == t) throw TypeError("Can't call method on " + t);
				return t;
			};
		},
		function (t, e, n) {
			var r = n(2);
			t.exports = function (t, e) {
				if (!r(t)) return t;
				var n, o;
				if (
					e &&
					"function" == typeof (n = t.toString) &&
					!r((o = n.call(t)))
				)
					return o;
				if ("function" == typeof (n = t.valueOf) && !r((o = n.call(t))))
					return o;
				if (
					!e &&
					"function" == typeof (n = t.toString) &&
					!r((o = n.call(t)))
				)
					return o;
				throw TypeError("Can't convert object to primitive value");
			};
		},
		function (t, e, n) {
			var r = n(0),
				o = n(8);
			t.exports = function (t, e) {
				try {
					o(r, t, e);
				} catch (n) {
					r[t] = e;
				}
				return e;
			};
		},
		function (t, e, n) {
			var r = n(50),
				o = n(29),
				i = r("keys");
			t.exports = function (t) {
				return i[t] || (i[t] = o(t));
			};
		},
		function (t, e) {
			t.exports = !1;
		},
		function (t, e) {
			var n = 0,
				r = Math.random();
			t.exports = function (t) {
				return (
					"Symbol(" +
					String(void 0 === t ? "" : t) +
					")_" +
					(++n + r).toString(36)
				);
			};
		},
		function (t, e, n) {
			var r = n(10),
				o = n(0),
				i = function (t) {
					return "function" == typeof t ? t : void 0;
				};
			t.exports = function (t, e) {
				return arguments.length < 2
					? i(r[t]) || i(o[t])
					: (r[t] && r[t][e]) || (o[t] && o[t][e]);
			};
		},
		function (t, e) {
			var n = Math.ceil,
				r = Math.floor;
			t.exports = function (t) {
				return isNaN((t = +t)) ? 0 : (t > 0 ? r : n)(t);
			};
		},
		function (t, e) {
			t.exports = [
				"constructor",
				"hasOwnProperty",
				"isPrototypeOf",
				"propertyIsEnumerable",
				"toLocaleString",
				"toString",
				"valueOf",
			];
		},
		function (t, e, n) {
			var r = n(7),
				o = n(54),
				i = n(17),
				u = n(19),
				c = n(56),
				a = n(58),
				s = function (t, e) {
					(this.stopped = t), (this.result = e);
				};
			(t.exports = function (t, e, n, f, l) {
				var p,
					h,
					d,
					v,
					y,
					m,
					g,
					x = u(e, n, f ? 2 : 1);
				if (l) p = t;
				else {
					if ("function" != typeof (h = c(t)))
						throw TypeError("Target is not iterable");
					if (o(h)) {
						for (d = 0, v = i(t.length); v > d; d++)
							if (
								(y = f ? x(r((g = t[d]))[0], g[1]) : x(t[d])) &&
								y instanceof s
							)
								return y;
						return new s(!1);
					}
					p = h.call(t);
				}
				for (m = p.next; !(g = m.call(p)).done; )
					if (
						"object" == typeof (y = a(p, x, g.value, f)) &&
						y &&
						y instanceof s
					)
						return y;
				return new s(!1);
			}).stop = function (t) {
				return new s(!0, t);
			};
		},
		function (t, e, n) {
			var r = {};
			(r[n(1)("toStringTag")] = "z"),
				(t.exports = "[object z]" === String(r));
		},
		function (t, e) {
			t.exports = function (t, e, n) {
				if (!(t instanceof e))
					throw TypeError(
						"Incorrect " + (n ? n + " " : "") + "invocation"
					);
				return t;
			};
		},
		function (t, e, n) {
			var r = n(5).f,
				o = n(3),
				i = n(1)("toStringTag");
			t.exports = function (t, e, n) {
				t &&
					!o((t = n ? t : t.prototype), i) &&
					r(t, i, { configurable: !0, value: e });
			};
		},
		function (t, e, n) {
			var r,
				o = n(7),
				i = n(79),
				u = n(32),
				c = n(16),
				a = n(80),
				s = n(46),
				f = n(27)("IE_PROTO"),
				l = function () {},
				p = function (t) {
					return "<script>" + t + "</script>";
				},
				h = function () {
					try {
						r = document.domain && new ActiveXObject("htmlfile");
					} catch (t) {}
					h = r
						? (function (t) {
								t.write(p("")), t.close();
								var e = t.parentWindow.Object;
								return (t = null), e;
						  })(r)
						: (function () {
								var t,
									e = s("iframe");
								return (
									(e.style.display = "none"),
									a.appendChild(e),
									(e.src = String("javascript:")),
									(t = e.contentWindow.document).open(),
									t.write(p("document.F=Object")),
									t.close(),
									t.F
								);
						  })();
					for (var t = u.length; t--; ) delete h.prototype[u[t]];
					return h();
				};
			(c[f] = !0),
				(t.exports =
					Object.create ||
					function (t, e) {
						var n;
						return (
							null !== t
								? ((l.prototype = o(t)),
								  (n = new l()),
								  (l.prototype = null),
								  (n[f] = t))
								: (n = h()),
							void 0 === e ? n : i(n, e)
						);
					});
		},
		function (t, e, n) {
			var r = n(11);
			t.exports = function (t, e, n) {
				for (var o in e) r(t, o, e[o], n);
				return t;
			};
		},
		function (t, e, n) {
			"use strict";
			var r = n(13),
				o = n(81),
				i = n(64),
				u = n(60),
				c = n(36),
				a = n(8),
				s = n(11),
				f = n(1),
				l = n(28),
				p = n(12),
				h = n(63),
				d = h.IteratorPrototype,
				v = h.BUGGY_SAFARI_ITERATORS,
				y = f("iterator"),
				m = function () {
					return this;
				};
			t.exports = function (t, e, n, f, h, g, x) {
				o(n, e, f);
				var b,
					w,
					S,
					_ = function (t) {
						if (t === h && P) return P;
						if (!v && t in T) return T[t];
						switch (t) {
							case "keys":
							case "values":
							case "entries":
								return function () {
									return new n(this, t);
								};
						}
						return function () {
							return new n(this);
						};
					},
					E = e + " Iterator",
					O = !1,
					T = t.prototype,
					A = T[y] || T["@@iterator"] || (h && T[h]),
					P = (!v && A) || _(h),
					j = ("Array" == e && T.entries) || A;
				if (
					(j &&
						((b = i(j.call(new t()))),
						d !== Object.prototype &&
							b.next &&
							(l ||
								i(b) === d ||
								(u
									? u(b, d)
									: "function" != typeof b[y] && a(b, y, m)),
							c(b, E, !0, !0),
							l && (p[E] = m))),
					"values" == h &&
						A &&
						"values" !== A.name &&
						((O = !0),
						(P = function () {
							return A.call(this);
						})),
					(l && !x) || T[y] === P || a(T, y, P),
					(p[e] = P),
					h)
				)
					if (
						((w = {
							values: _("values"),
							keys: g ? P : _("keys"),
							entries: _("entries"),
						}),
						x)
					)
						for (S in w) (!v && !O && S in T) || s(T, S, w[S]);
					else r({ target: e, proto: !0, forced: v || O }, w);
				return w;
			};
		},
		function (t, e, n) {
			var r = n(34),
				o = n(11),
				i = n(84);
			r || o(Object.prototype, "toString", i, { unsafe: !0 });
		},
		function (t, e, n) {
			"use strict";
			var r = n(85).charAt,
				o = n(9),
				i = n(39),
				u = o.set,
				c = o.getterFor("String Iterator");
			i(
				String,
				"String",
				function (t) {
					u(this, {
						type: "String Iterator",
						string: String(t),
						index: 0,
					});
				},
				function () {
					var t,
						e = c(this),
						n = e.string,
						o = e.index;
					return o >= n.length
						? { value: void 0, done: !0 }
						: ((t = r(n, o)),
						  (e.index += t.length),
						  { value: t, done: !1 });
				}
			);
		},
		function (t, e, n) {
			var r = n(0),
				o = n(86),
				i = n(87),
				u = n(8),
				c = n(1),
				a = c("iterator"),
				s = c("toStringTag"),
				f = i.values;
			for (var l in o) {
				var p = r[l],
					h = p && p.prototype;
				if (h) {
					if (h[a] !== f)
						try {
							u(h, a, f);
						} catch (t) {
							h[a] = f;
						}
					if ((h[s] || u(h, s, l), o[l]))
						for (var d in i)
							if (h[d] !== i[d])
								try {
									u(h, d, i[d]);
								} catch (t) {
									h[d] = i[d];
								}
				}
			}
		},
		function (t, e, n) {
			var r = n(6),
				o = n(44),
				i = n(14),
				u = n(15),
				c = n(25),
				a = n(3),
				s = n(45),
				f = Object.getOwnPropertyDescriptor;
			e.f = r
				? f
				: function (t, e) {
						if (((t = u(t)), (e = c(e, !0)), s))
							try {
								return f(t, e);
							} catch (t) {}
						if (a(t, e)) return i(!o.f.call(t, e), t[e]);
				  };
		},
		function (t, e, n) {
			"use strict";
			var r = {}.propertyIsEnumerable,
				o = Object.getOwnPropertyDescriptor,
				i = o && !r.call({ 1: 2 }, 1);
			e.f = i
				? function (t) {
						var e = o(this, t);
						return !!e && e.enumerable;
				  }
				: r;
		},
		function (t, e, n) {
			var r = n(6),
				o = n(4),
				i = n(46);
			t.exports =
				!r &&
				!o(function () {
					return (
						7 !=
						Object.defineProperty(i("div"), "a", {
							get: function () {
								return 7;
							},
						}).a
					);
				});
		},
		function (t, e, n) {
			var r = n(0),
				o = n(2),
				i = r.document,
				u = o(i) && o(i.createElement);
			t.exports = function (t) {
				return u ? i.createElement(t) : {};
			};
		},
		function (t, e, n) {
			var r = n(48),
				o = Function.toString;
			"function" != typeof r.inspectSource &&
				(r.inspectSource = function (t) {
					return o.call(t);
				}),
				(t.exports = r.inspectSource);
		},
		function (t, e, n) {
			var r = n(0),
				o = n(26),
				i = r["__core-js_shared__"] || o("__core-js_shared__", {});
			t.exports = i;
		},
		function (t, e, n) {
			var r = n(0),
				o = n(47),
				i = r.WeakMap;
			t.exports = "function" == typeof i && /native code/.test(o(i));
		},
		function (t, e, n) {
			var r = n(28),
				o = n(48);
			(t.exports = function (t, e) {
				return o[t] || (o[t] = void 0 !== e ? e : {});
			})("versions", []).push({
				version: "3.6.4",
				mode: r ? "pure" : "global",
				copyright: "© 2020 Denis Pushkarev (zloirock.ru)",
			});
		},
		function (t, e, n) {
			var r = n(3),
				o = n(15),
				i = n(72).indexOf,
				u = n(16);
			t.exports = function (t, e) {
				var n,
					c = o(t),
					a = 0,
					s = [];
				for (n in c) !r(u, n) && r(c, n) && s.push(n);
				for (; e.length > a; )
					r(c, (n = e[a++])) && (~i(s, n) || s.push(n));
				return s;
			};
		},
		function (t, e) {
			e.f = Object.getOwnPropertySymbols;
		},
		function (t, e, n) {
			var r = n(4),
				o = /#|\.prototype\./,
				i = function (t, e) {
					var n = c[u(t)];
					return (
						n == s ||
						(n != a && ("function" == typeof e ? r(e) : !!e))
					);
				},
				u = (i.normalize = function (t) {
					return String(t).replace(o, ".").toLowerCase();
				}),
				c = (i.data = {}),
				a = (i.NATIVE = "N"),
				s = (i.POLYFILL = "P");
			t.exports = i;
		},
		function (t, e, n) {
			var r = n(1),
				o = n(12),
				i = r("iterator"),
				u = Array.prototype;
			t.exports = function (t) {
				return void 0 !== t && (o.Array === t || u[i] === t);
			};
		},
		function (t, e, n) {
			var r = n(4);
			t.exports =
				!!Object.getOwnPropertySymbols &&
				!r(function () {
					return !String(Symbol());
				});
		},
		function (t, e, n) {
			var r = n(57),
				o = n(12),
				i = n(1)("iterator");
			t.exports = function (t) {
				if (null != t) return t[i] || t["@@iterator"] || o[r(t)];
			};
		},
		function (t, e, n) {
			var r = n(34),
				o = n(23),
				i = n(1)("toStringTag"),
				u =
					"Arguments" ==
					o(
						(function () {
							return arguments;
						})()
					);
			t.exports = r
				? o
				: function (t) {
						var e, n, r;
						return void 0 === t
							? "Undefined"
							: null === t
							? "Null"
							: "string" ==
							  typeof (n = (function (t, e) {
									try {
										return t[e];
									} catch (t) {}
							  })((e = Object(t)), i))
							? n
							: u
							? o(e)
							: "Object" == (r = o(e)) &&
							  "function" == typeof e.callee
							? "Arguments"
							: r;
				  };
		},
		function (t, e, n) {
			var r = n(7);
			t.exports = function (t, e, n, o) {
				try {
					return o ? e(r(n)[0], n[1]) : e(n);
				} catch (e) {
					var i = t.return;
					throw (void 0 !== i && r(i.call(t)), e);
				}
			};
		},
		function (t, e, n) {
			var r = n(1)("iterator"),
				o = !1;
			try {
				var i = 0,
					u = {
						next: function () {
							return { done: !!i++ };
						},
						return: function () {
							o = !0;
						},
					};
				(u[r] = function () {
					return this;
				}),
					Array.from(u, function () {
						throw 2;
					});
			} catch (t) {}
			t.exports = function (t, e) {
				if (!e && !o) return !1;
				var n = !1;
				try {
					var i = {};
					(i[r] = function () {
						return {
							next: function () {
								return { done: (n = !0) };
							},
						};
					}),
						t(i);
				} catch (t) {}
				return n;
			};
		},
		function (t, e, n) {
			var r = n(7),
				o = n(78);
			t.exports =
				Object.setPrototypeOf ||
				("__proto__" in {}
					? (function () {
							var t,
								e = !1,
								n = {};
							try {
								(t = Object.getOwnPropertyDescriptor(
									Object.prototype,
									"__proto__"
								).set).call(n, []),
									(e = n instanceof Array);
							} catch (t) {}
							return function (n, i) {
								return (
									r(n),
									o(i),
									e ? t.call(n, i) : (n.__proto__ = i),
									n
								);
							};
					  })()
					: void 0);
		},
		function (t, e, n) {
			"use strict";
			var r = n(5).f,
				o = n(37),
				i = n(38),
				u = n(19),
				c = n(35),
				a = n(33),
				s = n(39),
				f = n(83),
				l = n(6),
				p = n(18).fastKey,
				h = n(9),
				d = h.set,
				v = h.getterFor;
			t.exports = {
				getConstructor: function (t, e, n, s) {
					var f = t(function (t, r) {
							c(t, f, e),
								d(t, {
									type: e,
									index: o(null),
									first: void 0,
									last: void 0,
									size: 0,
								}),
								l || (t.size = 0),
								null != r && a(r, t[s], t, n);
						}),
						h = v(e),
						y = function (t, e, n) {
							var r,
								o,
								i = h(t),
								u = m(t, e);
							return (
								u
									? (u.value = n)
									: ((i.last = u =
											{
												index: (o = p(e, !0)),
												key: e,
												value: n,
												previous: (r = i.last),
												next: void 0,
												removed: !1,
											}),
									  i.first || (i.first = u),
									  r && (r.next = u),
									  l ? i.size++ : t.size++,
									  "F" !== o && (i.index[o] = u)),
								t
							);
						},
						m = function (t, e) {
							var n,
								r = h(t),
								o = p(e);
							if ("F" !== o) return r.index[o];
							for (n = r.first; n; n = n.next)
								if (n.key == e) return n;
						};
					return (
						i(f.prototype, {
							clear: function () {
								for (
									var t = h(this), e = t.index, n = t.first;
									n;

								)
									(n.removed = !0),
										n.previous &&
											(n.previous = n.previous.next =
												void 0),
										delete e[n.index],
										(n = n.next);
								(t.first = t.last = void 0),
									l ? (t.size = 0) : (this.size = 0);
							},
							delete: function (t) {
								var e = h(this),
									n = m(this, t);
								if (n) {
									var r = n.next,
										o = n.previous;
									delete e.index[n.index],
										(n.removed = !0),
										o && (o.next = r),
										r && (r.previous = o),
										e.first == n && (e.first = r),
										e.last == n && (e.last = o),
										l ? e.size-- : this.size--;
								}
								return !!n;
							},
							forEach: function (t) {
								for (
									var e,
										n = h(this),
										r = u(
											t,
											arguments.length > 1
												? arguments[1]
												: void 0,
											3
										);
									(e = e ? e.next : n.first);

								)
									for (
										r(e.value, e.key, this);
										e && e.removed;

									)
										e = e.previous;
							},
							has: function (t) {
								return !!m(this, t);
							},
						}),
						i(
							f.prototype,
							n
								? {
										get: function (t) {
											var e = m(this, t);
											return e && e.value;
										},
										set: function (t, e) {
											return y(this, 0 === t ? 0 : t, e);
										},
								  }
								: {
										add: function (t) {
											return y(
												this,
												(t = 0 === t ? 0 : t),
												t
											);
										},
								  }
						),
						l &&
							r(f.prototype, "size", {
								get: function () {
									return h(this).size;
								},
							}),
						f
					);
				},
				setStrong: function (t, e, n) {
					var r = e + " Iterator",
						o = v(e),
						i = v(r);
					s(
						t,
						e,
						function (t, e) {
							d(this, {
								type: r,
								target: t,
								state: o(t),
								kind: e,
								last: void 0,
							});
						},
						function () {
							for (
								var t = i(this), e = t.kind, n = t.last;
								n && n.removed;

							)
								n = n.previous;
							return t.target &&
								(t.last = n = n ? n.next : t.state.first)
								? "keys" == e
									? { value: n.key, done: !1 }
									: "values" == e
									? { value: n.value, done: !1 }
									: { value: [n.key, n.value], done: !1 }
								: ((t.target = void 0),
								  { value: void 0, done: !0 });
						},
						n ? "entries" : "values",
						!n,
						!0
					),
						f(e);
				},
			};
		},
		function (t, e, n) {
			var r = n(51),
				o = n(32);
			t.exports =
				Object.keys ||
				function (t) {
					return r(t, o);
				};
		},
		function (t, e, n) {
			"use strict";
			var r,
				o,
				i,
				u = n(64),
				c = n(8),
				a = n(3),
				s = n(1),
				f = n(28),
				l = s("iterator"),
				p = !1;
			[].keys &&
				("next" in (i = [].keys())
					? (o = u(u(i))) !== Object.prototype && (r = o)
					: (p = !0)),
				null == r && (r = {}),
				f ||
					a(r, l) ||
					c(r, l, function () {
						return this;
					}),
				(t.exports = {
					IteratorPrototype: r,
					BUGGY_SAFARI_ITERATORS: p,
				});
		},
		function (t, e, n) {
			var r = n(3),
				o = n(20),
				i = n(27),
				u = n(82),
				c = i("IE_PROTO"),
				a = Object.prototype;
			t.exports = u
				? Object.getPrototypeOf
				: function (t) {
						return (
							(t = o(t)),
							r(t, c)
								? t[c]
								: "function" == typeof t.constructor &&
								  t instanceof t.constructor
								? t.constructor.prototype
								: t instanceof Object
								? a
								: null
						);
				  };
		},
		function (t, e, n) {
			t.exports = n(104);
		},
		function (t, e, n) {
			n(67), n(40), n(41), n(42);
			var r = n(10);
			t.exports = r.Map;
		},
		function (t, e, n) {
			"use strict";
			var r = n(21),
				o = n(61);
			t.exports = r(
				"Map",
				function (t) {
					return function () {
						return t(
							this,
							arguments.length ? arguments[0] : void 0
						);
					};
				},
				o
			);
		},
		function (t, e) {
			var n;
			n = (function () {
				return this;
			})();
			try {
				n = n || new Function("return this")();
			} catch (t) {
				"object" == typeof window && (n = window);
			}
			t.exports = n;
		},
		function (t, e, n) {
			var r = n(3),
				o = n(70),
				i = n(43),
				u = n(5);
			t.exports = function (t, e) {
				for (var n = o(e), c = u.f, a = i.f, s = 0; s < n.length; s++) {
					var f = n[s];
					r(t, f) || c(t, f, a(e, f));
				}
			};
		},
		function (t, e, n) {
			var r = n(30),
				o = n(71),
				i = n(52),
				u = n(7);
			t.exports =
				r("Reflect", "ownKeys") ||
				function (t) {
					var e = o.f(u(t)),
						n = i.f;
					return n ? e.concat(n(t)) : e;
				};
		},
		function (t, e, n) {
			var r = n(51),
				o = n(32).concat("length", "prototype");
			e.f =
				Object.getOwnPropertyNames ||
				function (t) {
					return r(t, o);
				};
		},
		function (t, e, n) {
			var r = n(15),
				o = n(17),
				i = n(73),
				u = function (t) {
					return function (e, n, u) {
						var c,
							a = r(e),
							s = o(a.length),
							f = i(u, s);
						if (t && n != n) {
							for (; s > f; ) if ((c = a[f++]) != c) return !0;
						} else
							for (; s > f; f++)
								if ((t || f in a) && a[f] === n)
									return t || f || 0;
						return !t && -1;
					};
				};
			t.exports = { includes: u(!0), indexOf: u(!1) };
		},
		function (t, e, n) {
			var r = n(31),
				o = Math.max,
				i = Math.min;
			t.exports = function (t, e) {
				var n = r(t);
				return n < 0 ? o(n + e, 0) : i(n, e);
			};
		},
		function (t, e, n) {
			var r = n(4);
			t.exports = !r(function () {
				return Object.isExtensible(Object.preventExtensions({}));
			});
		},
		function (t, e, n) {
			var r = n(55);
			t.exports = r && !Symbol.sham && "symbol" == typeof Symbol.iterator;
		},
		function (t, e) {
			t.exports = function (t) {
				if ("function" != typeof t)
					throw TypeError(String(t) + " is not a function");
				return t;
			};
		},
		function (t, e, n) {
			var r = n(2),
				o = n(60);
			t.exports = function (t, e, n) {
				var i, u;
				return (
					o &&
						"function" == typeof (i = e.constructor) &&
						i !== n &&
						r((u = i.prototype)) &&
						u !== n.prototype &&
						o(t, u),
					t
				);
			};
		},
		function (t, e, n) {
			var r = n(2);
			t.exports = function (t) {
				if (!r(t) && null !== t)
					throw TypeError(
						"Can't set " + String(t) + " as a prototype"
					);
				return t;
			};
		},
		function (t, e, n) {
			var r = n(6),
				o = n(5),
				i = n(7),
				u = n(62);
			t.exports = r
				? Object.defineProperties
				: function (t, e) {
						i(t);
						for (var n, r = u(e), c = r.length, a = 0; c > a; )
							o.f(t, (n = r[a++]), e[n]);
						return t;
				  };
		},
		function (t, e, n) {
			var r = n(30);
			t.exports = r("document", "documentElement");
		},
		function (t, e, n) {
			"use strict";
			var r = n(63).IteratorPrototype,
				o = n(37),
				i = n(14),
				u = n(36),
				c = n(12),
				a = function () {
					return this;
				};
			t.exports = function (t, e, n) {
				var s = e + " Iterator";
				return (
					(t.prototype = o(r, { next: i(1, n) })),
					u(t, s, !1, !0),
					(c[s] = a),
					t
				);
			};
		},
		function (t, e, n) {
			var r = n(4);
			t.exports = !r(function () {
				function t() {}
				return (
					(t.prototype.constructor = null),
					Object.getPrototypeOf(new t()) !== t.prototype
				);
			});
		},
		function (t, e, n) {
			"use strict";
			var r = n(30),
				o = n(5),
				i = n(1),
				u = n(6),
				c = i("species");
			t.exports = function (t) {
				var e = r(t),
					n = o.f;
				u &&
					e &&
					!e[c] &&
					n(e, c, {
						configurable: !0,
						get: function () {
							return this;
						},
					});
			};
		},
		function (t, e, n) {
			"use strict";
			var r = n(34),
				o = n(57);
			t.exports = r
				? {}.toString
				: function () {
						return "[object " + o(this) + "]";
				  };
		},
		function (t, e, n) {
			var r = n(31),
				o = n(24),
				i = function (t) {
					return function (e, n) {
						var i,
							u,
							c = String(o(e)),
							a = r(n),
							s = c.length;
						return a < 0 || a >= s
							? t
								? ""
								: void 0
							: (i = c.charCodeAt(a)) < 55296 ||
							  i > 56319 ||
							  a + 1 === s ||
							  (u = c.charCodeAt(a + 1)) < 56320 ||
							  u > 57343
							? t
								? c.charAt(a)
								: i
							: t
							? c.slice(a, a + 2)
							: u - 56320 + ((i - 55296) << 10) + 65536;
					};
				};
			t.exports = { codeAt: i(!1), charAt: i(!0) };
		},
		function (t, e) {
			t.exports = {
				CSSRuleList: 0,
				CSSStyleDeclaration: 0,
				CSSValueList: 0,
				ClientRectList: 0,
				DOMRectList: 0,
				DOMStringList: 0,
				DOMTokenList: 1,
				DataTransferItemList: 0,
				FileList: 0,
				HTMLAllCollection: 0,
				HTMLCollection: 0,
				HTMLFormElement: 0,
				HTMLSelectElement: 0,
				MediaList: 0,
				MimeTypeArray: 0,
				NamedNodeMap: 0,
				NodeList: 1,
				PaintRequestList: 0,
				Plugin: 0,
				PluginArray: 0,
				SVGLengthList: 0,
				SVGNumberList: 0,
				SVGPathSegList: 0,
				SVGPointList: 0,
				SVGStringList: 0,
				SVGTransformList: 0,
				SourceBufferList: 0,
				StyleSheetList: 0,
				TextTrackCueList: 0,
				TextTrackList: 0,
				TouchList: 0,
			};
		},
		function (t, e, n) {
			"use strict";
			var r = n(15),
				o = n(88),
				i = n(12),
				u = n(9),
				c = n(39),
				a = u.set,
				s = u.getterFor("Array Iterator");
			(t.exports = c(
				Array,
				"Array",
				function (t, e) {
					a(this, {
						type: "Array Iterator",
						target: r(t),
						index: 0,
						kind: e,
					});
				},
				function () {
					var t = s(this),
						e = t.target,
						n = t.kind,
						r = t.index++;
					return !e || r >= e.length
						? ((t.target = void 0), { value: void 0, done: !0 })
						: "keys" == n
						? { value: r, done: !1 }
						: "values" == n
						? { value: e[r], done: !1 }
						: { value: [r, e[r]], done: !1 };
				},
				"values"
			)),
				(i.Arguments = i.Array),
				o("keys"),
				o("values"),
				o("entries");
		},
		function (t, e, n) {
			var r = n(1),
				o = n(37),
				i = n(5),
				u = r("unscopables"),
				c = Array.prototype;
			null == c[u] && i.f(c, u, { configurable: !0, value: o(null) }),
				(t.exports = function (t) {
					c[u][t] = !0;
				});
		},
		function (t, e, n) {
			n(90), n(40), n(41), n(42);
			var r = n(10);
			t.exports = r.Set;
		},
		function (t, e, n) {
			"use strict";
			var r = n(21),
				o = n(61);
			t.exports = r(
				"Set",
				function (t) {
					return function () {
						return t(
							this,
							arguments.length ? arguments[0] : void 0
						);
					};
				},
				o
			);
		},
		function (t, e, n) {
			n(40), n(92), n(42);
			var r = n(10);
			t.exports = r.WeakMap;
		},
		function (t, e, n) {
			"use strict";
			var r,
				o = n(0),
				i = n(38),
				u = n(18),
				c = n(21),
				a = n(93),
				s = n(2),
				f = n(9).enforce,
				l = n(49),
				p = !o.ActiveXObject && "ActiveXObject" in o,
				h = Object.isExtensible,
				d = function (t) {
					return function () {
						return t(
							this,
							arguments.length ? arguments[0] : void 0
						);
					};
				},
				v = (t.exports = c("WeakMap", d, a));
			if (l && p) {
				(r = a.getConstructor(d, "WeakMap", !0)), (u.REQUIRED = !0);
				var y = v.prototype,
					m = y.delete,
					g = y.has,
					x = y.get,
					b = y.set;
				i(y, {
					delete: function (t) {
						if (s(t) && !h(t)) {
							var e = f(this);
							return (
								e.frozen || (e.frozen = new r()),
								m.call(this, t) || e.frozen.delete(t)
							);
						}
						return m.call(this, t);
					},
					has: function (t) {
						if (s(t) && !h(t)) {
							var e = f(this);
							return (
								e.frozen || (e.frozen = new r()),
								g.call(this, t) || e.frozen.has(t)
							);
						}
						return g.call(this, t);
					},
					get: function (t) {
						if (s(t) && !h(t)) {
							var e = f(this);
							return (
								e.frozen || (e.frozen = new r()),
								g.call(this, t)
									? x.call(this, t)
									: e.frozen.get(t)
							);
						}
						return x.call(this, t);
					},
					set: function (t, e) {
						if (s(t) && !h(t)) {
							var n = f(this);
							n.frozen || (n.frozen = new r()),
								g.call(this, t)
									? b.call(this, t, e)
									: n.frozen.set(t, e);
						} else b.call(this, t, e);
						return this;
					},
				});
			}
		},
		function (t, e, n) {
			"use strict";
			var r = n(38),
				o = n(18).getWeakData,
				i = n(7),
				u = n(2),
				c = n(35),
				a = n(33),
				s = n(94),
				f = n(3),
				l = n(9),
				p = l.set,
				h = l.getterFor,
				d = s.find,
				v = s.findIndex,
				y = 0,
				m = function (t) {
					return t.frozen || (t.frozen = new g());
				},
				g = function () {
					this.entries = [];
				},
				x = function (t, e) {
					return d(t.entries, function (t) {
						return t[0] === e;
					});
				};
			(g.prototype = {
				get: function (t) {
					var e = x(this, t);
					if (e) return e[1];
				},
				has: function (t) {
					return !!x(this, t);
				},
				set: function (t, e) {
					var n = x(this, t);
					n ? (n[1] = e) : this.entries.push([t, e]);
				},
				delete: function (t) {
					var e = v(this.entries, function (e) {
						return e[0] === t;
					});
					return ~e && this.entries.splice(e, 1), !!~e;
				},
			}),
				(t.exports = {
					getConstructor: function (t, e, n, s) {
						var l = t(function (t, r) {
								c(t, l, e),
									p(t, { type: e, id: y++, frozen: void 0 }),
									null != r && a(r, t[s], t, n);
							}),
							d = h(e),
							v = function (t, e, n) {
								var r = d(t),
									u = o(i(e), !0);
								return (
									!0 === u ? m(r).set(e, n) : (u[r.id] = n), t
								);
							};
						return (
							r(l.prototype, {
								delete: function (t) {
									var e = d(this);
									if (!u(t)) return !1;
									var n = o(t);
									return !0 === n
										? m(e).delete(t)
										: n && f(n, e.id) && delete n[e.id];
								},
								has: function (t) {
									var e = d(this);
									if (!u(t)) return !1;
									var n = o(t);
									return !0 === n
										? m(e).has(t)
										: n && f(n, e.id);
								},
							}),
							r(
								l.prototype,
								n
									? {
											get: function (t) {
												var e = d(this);
												if (u(t)) {
													var n = o(t);
													return !0 === n
														? m(e).get(t)
														: n
														? n[e.id]
														: void 0;
												}
											},
											set: function (t, e) {
												return v(this, t, e);
											},
									  }
									: {
											add: function (t) {
												return v(this, t, !0);
											},
									  }
							),
							l
						);
					},
				});
		},
		function (t, e, n) {
			var r = n(19),
				o = n(22),
				i = n(20),
				u = n(17),
				c = n(95),
				a = [].push,
				s = function (t) {
					var e = 1 == t,
						n = 2 == t,
						s = 3 == t,
						f = 4 == t,
						l = 6 == t,
						p = 5 == t || l;
					return function (h, d, v, y) {
						for (
							var m,
								g,
								x = i(h),
								b = o(x),
								w = r(d, v, 3),
								S = u(b.length),
								_ = 0,
								E = y || c,
								O = e ? E(h, S) : n ? E(h, 0) : void 0;
							S > _;
							_++
						)
							if ((p || _ in b) && ((g = w((m = b[_]), _, x)), t))
								if (e) O[_] = g;
								else if (g)
									switch (t) {
										case 3:
											return !0;
										case 5:
											return m;
										case 6:
											return _;
										case 2:
											a.call(O, m);
									}
								else if (f) return !1;
						return l ? -1 : s || f ? f : O;
					};
				};
			t.exports = {
				forEach: s(0),
				map: s(1),
				filter: s(2),
				some: s(3),
				every: s(4),
				find: s(5),
				findIndex: s(6),
			};
		},
		function (t, e, n) {
			var r = n(2),
				o = n(96),
				i = n(1)("species");
			t.exports = function (t, e) {
				var n;
				return (
					o(t) &&
						("function" != typeof (n = t.constructor) ||
						(n !== Array && !o(n.prototype))
							? r(n) && null === (n = n[i]) && (n = void 0)
							: (n = void 0)),
					new (void 0 === n ? Array : n)(0 === e ? 0 : e)
				);
			};
		},
		function (t, e, n) {
			var r = n(23);
			t.exports =
				Array.isArray ||
				function (t) {
					return "Array" == r(t);
				};
		},
		function (t, e, n) {
			n(41), n(98);
			var r = n(10);
			t.exports = r.Array.from;
		},
		function (t, e, n) {
			var r = n(13),
				o = n(99);
			r(
				{
					target: "Array",
					stat: !0,
					forced: !n(59)(function (t) {
						Array.from(t);
					}),
				},
				{ from: o }
			);
		},
		function (t, e, n) {
			"use strict";
			var r = n(19),
				o = n(20),
				i = n(58),
				u = n(54),
				c = n(17),
				a = n(100),
				s = n(56);
			t.exports = function (t) {
				var e,
					n,
					f,
					l,
					p,
					h,
					d = o(t),
					v = "function" == typeof this ? this : Array,
					y = arguments.length,
					m = y > 1 ? arguments[1] : void 0,
					g = void 0 !== m,
					x = s(d),
					b = 0;
				if (
					(g && (m = r(m, y > 2 ? arguments[2] : void 0, 2)),
					null == x || (v == Array && u(x)))
				)
					for (n = new v((e = c(d.length))); e > b; b++)
						(h = g ? m(d[b], b) : d[b]), a(n, b, h);
				else
					for (
						p = (l = x.call(d)).next, n = new v();
						!(f = p.call(l)).done;
						b++
					)
						(h = g ? i(l, m, [f.value, b], !0) : f.value),
							a(n, b, h);
				return (n.length = b), n;
			};
		},
		function (t, e, n) {
			"use strict";
			var r = n(25),
				o = n(5),
				i = n(14);
			t.exports = function (t, e, n) {
				var u = r(e);
				u in t ? o.f(t, u, i(0, n)) : (t[u] = n);
			};
		},
		function (t, e, n) {
			n(102);
			var r = n(10);
			t.exports = r.Object.assign;
		},
		function (t, e, n) {
			var r = n(13),
				o = n(103);
			r(
				{ target: "Object", stat: !0, forced: Object.assign !== o },
				{ assign: o }
			);
		},
		function (t, e, n) {
			"use strict";
			var r = n(6),
				o = n(4),
				i = n(62),
				u = n(52),
				c = n(44),
				a = n(20),
				s = n(22),
				f = Object.assign,
				l = Object.defineProperty;
			t.exports =
				!f ||
				o(function () {
					if (
						r &&
						1 !==
							f(
								{ b: 1 },
								f(
									l({}, "a", {
										enumerable: !0,
										get: function () {
											l(this, "b", {
												value: 3,
												enumerable: !1,
											});
										},
									}),
									{ b: 2 }
								)
							).b
					)
						return !0;
					var t = {},
						e = {},
						n = Symbol();
					return (
						(t[n] = 7),
						"abcdefghijklmnopqrst".split("").forEach(function (t) {
							e[t] = t;
						}),
						7 != f({}, t)[n] ||
							"abcdefghijklmnopqrst" != i(f({}, e)).join("")
					);
				})
					? function (t, e) {
							for (
								var n = a(t),
									o = arguments.length,
									f = 1,
									l = u.f,
									p = c.f;
								o > f;

							)
								for (
									var h,
										d = s(arguments[f++]),
										v = l ? i(d).concat(l(d)) : i(d),
										y = v.length,
										m = 0;
									y > m;

								)
									(h = v[m++]),
										(r && !p.call(d, h)) || (n[h] = d[h]);
							return n;
					  }
					: f;
		},
		function (t, e, n) {
			"use strict";
			n.r(e);
			var r = {};
			n.r(r),
				n.d(r, "keyboardHandler", function () {
					return I;
				}),
				n.d(r, "mouseHandler", function () {
					return R;
				}),
				n.d(r, "resizeHandler", function () {
					return C;
				}),
				n.d(r, "selectHandler", function () {
					return N;
				}),
				n.d(r, "touchHandler", function () {
					return F;
				}),
				n.d(r, "wheelHandler", function () {
					return H;
				});
			/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
			var o = function (t, e) {
					return (o =
						Object.setPrototypeOf ||
						({ __proto__: [] } instanceof Array &&
							function (t, e) {
								t.__proto__ = e;
							}) ||
						function (t, e) {
							for (var n in e)
								e.hasOwnProperty(n) && (t[n] = e[n]);
						})(t, e);
				},
				i = function () {
					return (i =
						Object.assign ||
						function (t) {
							for (var e, n = 1, r = arguments.length; n < r; n++)
								for (var o in (e = arguments[n]))
									Object.prototype.hasOwnProperty.call(
										e,
										o
									) && (t[o] = e[o]);
							return t;
						}).apply(this, arguments);
				};
			function u(t, e, n, r) {
				var o,
					i = arguments.length,
					u =
						i < 3
							? e
							: null === r
							? (r = Object.getOwnPropertyDescriptor(e, n))
							: r;
				if (
					"object" == typeof Reflect &&
					"function" == typeof Reflect.decorate
				)
					u = Reflect.decorate(t, e, n, r);
				else
					for (var c = t.length - 1; c >= 0; c--)
						(o = t[c]) &&
							(u =
								(i < 3 ? o(u) : i > 3 ? o(e, n, u) : o(e, n)) ||
								u);
				return i > 3 && u && Object.defineProperty(e, n, u), u;
			}
			n(66), n(89), n(91), n(97), n(101);
			var c,
				a = new WeakMap();
			function s() {
				if (void 0 !== c) return c;
				var t = !1;
				try {
					var e = function () {},
						n = Object.defineProperty({}, "passive", {
							enumerable: !0,
							get: function () {
								return (t = !0), !0;
							},
						});
					window.addEventListener("testPassive", e, n),
						window.removeEventListener("testPassive", e, n);
				} catch (t) {}
				return (c = !!t && { passive: !1 });
			}
			function f(t) {
				var e = a.get(t) || [];
				return (
					a.set(t, e),
					function (t, n, r) {
						function o(t) {
							t.defaultPrevented || r(t);
						}
						n.split(/\s+/g).forEach(function (n) {
							e.push({ elem: t, eventName: n, handler: o }),
								t.addEventListener(n, o, s());
						});
					}
				);
			}
			function l(t) {
				var e = (function (t) {
					return t.touches ? t.touches[t.touches.length - 1] : t;
				})(t);
				return { x: e.clientX, y: e.clientY };
			}
			function p(t, e) {
				return (
					void 0 === e && (e = []),
					e.some(function (e) {
						return t === e;
					})
				);
			}
			var h = ["webkit", "moz", "ms", "o"],
				d = new RegExp("^-(?!(?:" + h.join("|") + ")-)");
			function v(t, e) {
				(e = (function (t) {
					var e = {};
					return (
						Object.keys(t).forEach(function (n) {
							if (d.test(n)) {
								var r = t[n];
								(n = n.replace(/^-/, "")),
									(e[n] = r),
									h.forEach(function (t) {
										e["-" + t + "-" + n] = r;
									});
							} else e[n] = t[n];
						}),
						e
					);
				})(e)),
					Object.keys(e).forEach(function (n) {
						var r = n
							.replace(/^-/, "")
							.replace(/-([a-z])/g, function (t, e) {
								return e.toUpperCase();
							});
						t.style[r] = e[n];
					});
			}
			var y = (function () {
					function t(t) {
						(this.velocityMultiplier = window.devicePixelRatio),
							(this.updateTime = Date.now()),
							(this.delta = { x: 0, y: 0 }),
							(this.velocity = { x: 0, y: 0 }),
							(this.lastPosition = { x: 0, y: 0 }),
							(this.lastPosition = l(t));
					}
					return (
						(t.prototype.update = function (t) {
							var e = this.velocity,
								n = this.updateTime,
								r = this.lastPosition,
								o = Date.now(),
								i = l(t),
								u = { x: -(i.x - r.x), y: -(i.y - r.y) },
								c = o - n || 16.7,
								a = (u.x / c) * 16.7,
								s = (u.y / c) * 16.7;
							(e.x = a * this.velocityMultiplier),
								(e.y = s * this.velocityMultiplier),
								(this.delta = u),
								(this.updateTime = o),
								(this.lastPosition = i);
						}),
						t
					);
				})(),
				m = (function () {
					function t() {
						this._touchList = {};
					}
					return (
						Object.defineProperty(t.prototype, "_primitiveValue", {
							get: function () {
								return { x: 0, y: 0 };
							},
							enumerable: !0,
							configurable: !0,
						}),
						(t.prototype.isActive = function () {
							return void 0 !== this._activeTouchID;
						}),
						(t.prototype.getDelta = function () {
							var t = this._getActiveTracker();
							return t ? i({}, t.delta) : this._primitiveValue;
						}),
						(t.prototype.getVelocity = function () {
							var t = this._getActiveTracker();
							return t ? i({}, t.velocity) : this._primitiveValue;
						}),
						(t.prototype.getEasingDistance = function (t) {
							var e = 1 - t,
								n = { x: 0, y: 0 },
								r = this.getVelocity();
							return (
								Object.keys(r).forEach(function (t) {
									for (
										var o = Math.abs(r[t]) <= 10 ? 0 : r[t];
										0 !== o;

									)
										(n[t] += o), (o = (o * e) | 0);
								}),
								n
							);
						}),
						(t.prototype.track = function (t) {
							var e = this,
								n = t.targetTouches;
							return (
								Array.from(n).forEach(function (t) {
									e._add(t);
								}),
								this._touchList
							);
						}),
						(t.prototype.update = function (t) {
							var e = this,
								n = t.touches,
								r = t.changedTouches;
							return (
								Array.from(n).forEach(function (t) {
									e._renew(t);
								}),
								this._setActiveID(r),
								this._touchList
							);
						}),
						(t.prototype.release = function (t) {
							var e = this;
							delete this._activeTouchID,
								Array.from(t.changedTouches).forEach(function (
									t
								) {
									e._delete(t);
								});
						}),
						(t.prototype._add = function (t) {
							this._has(t) && this._delete(t);
							var e = new y(t);
							this._touchList[t.identifier] = e;
						}),
						(t.prototype._renew = function (t) {
							this._has(t) &&
								this._touchList[t.identifier].update(t);
						}),
						(t.prototype._delete = function (t) {
							delete this._touchList[t.identifier];
						}),
						(t.prototype._has = function (t) {
							return this._touchList.hasOwnProperty(t.identifier);
						}),
						(t.prototype._setActiveID = function (t) {
							this._activeTouchID = t[t.length - 1].identifier;
						}),
						(t.prototype._getActiveTracker = function () {
							return this._touchList[this._activeTouchID];
						}),
						t
					);
				})();
			function g(t, e, n) {
				return Math.max(e, Math.min(n, t));
			}
			function x(t, e, n) {
				var r;
				void 0 === e && (e = 0);
				var o = -1 / 0;
				return function () {
					for (var i = this, u = [], c = 0; c < arguments.length; c++)
						u[c] = arguments[c];
					if (n) {
						var a = Date.now(),
							s = a - o;
						(o = a), s >= e && t.apply(this, u);
					}
					clearTimeout(r),
						(r = setTimeout(function () {
							t.apply(i, u);
						}, e));
				};
			}
			function b(t, e) {
				return (
					void 0 === t && (t = -1 / 0),
					void 0 === e && (e = 1 / 0),
					function (n, r) {
						var o = "_" + r;
						Object.defineProperty(n, r, {
							get: function () {
								return this[o];
							},
							set: function (n) {
								Object.defineProperty(this, o, {
									value: g(n, t, e),
									enumerable: !1,
									writable: !0,
									configurable: !0,
								});
							},
							enumerable: !0,
							configurable: !0,
						});
					}
				);
			}
			function w(t, e) {
				var n = "_" + e;
				Object.defineProperty(t, e, {
					get: function () {
						return this[n];
					},
					set: function (t) {
						Object.defineProperty(this, n, {
							value: !!t,
							enumerable: !1,
							writable: !0,
							configurable: !0,
						});
					},
					enumerable: !0,
					configurable: !0,
				});
			}
			function S() {
				for (var t = [], e = 0; e < arguments.length; e++)
					t[e] = arguments[e];
				return function (e, n, r) {
					var o = r.value;
					return {
						get: function () {
							return (
								this.hasOwnProperty(n) ||
									Object.defineProperty(this, n, {
										value: x.apply(
											void 0,
											(function () {
												for (
													var t = 0,
														e = 0,
														n = arguments.length;
													e < n;
													e++
												)
													t += arguments[e].length;
												var r = Array(t),
													o = 0;
												for (e = 0; e < n; e++)
													for (
														var i = arguments[e],
															u = 0,
															c = i.length;
														u < c;
														u++, o++
													)
														r[o] = i[u];
												return r;
											})([o], t)
										),
									}),
								this[n]
							);
						},
					};
				};
			}
			var _,
				E = (function () {
					function t(t) {
						var e = this;
						void 0 === t && (t = {}),
							(this.damping = 0.1),
							(this.thumbMinSize = 20),
							(this.renderByPixels = !0),
							(this.alwaysShowTracks = !1),
							(this.continuousScrolling = !0),
							(this.delegateTo = null),
							(this.plugins = {}),
							Object.keys(t).forEach(function (n) {
								e[n] = t[n];
							});
					}
					return (
						Object.defineProperty(t.prototype, "wheelEventTarget", {
							get: function () {
								return this.delegateTo;
							},
							set: function (t) {
								console.warn(
									"[smooth-scrollbar]: `options.wheelEventTarget` is deprecated and will be removed in the future, use `options.delegateTo` instead."
								),
									(this.delegateTo = t);
							},
							enumerable: !0,
							configurable: !0,
						}),
						u([b(0, 1)], t.prototype, "damping", void 0),
						u([b(0, 1 / 0)], t.prototype, "thumbMinSize", void 0),
						u([w], t.prototype, "renderByPixels", void 0),
						u([w], t.prototype, "alwaysShowTracks", void 0),
						u([w], t.prototype, "continuousScrolling", void 0),
						t
					);
				})();
			!(function (t) {
				(t.X = "x"), (t.Y = "y");
			})(_ || (_ = {}));
			var O = (function () {
					function t(t, e) {
						void 0 === e && (e = 0),
							(this._direction = t),
							(this._minSize = e),
							(this.element = document.createElement("div")),
							(this.displaySize = 0),
							(this.realSize = 0),
							(this.offset = 0),
							(this.element.className =
								"scrollbar-thumb scrollbar-thumb-" + t);
					}
					return (
						(t.prototype.attachTo = function (t) {
							t.appendChild(this.element);
						}),
						(t.prototype.update = function (t, e, n) {
							(this.realSize = Math.min(e / n, 1) * e),
								(this.displaySize = Math.max(
									this.realSize,
									this._minSize
								)),
								(this.offset =
									(t / n) *
									(e + (this.realSize - this.displaySize))),
								v(this.element, this._getStyle());
						}),
						(t.prototype._getStyle = function () {
							switch (this._direction) {
								case _.X:
									return {
										width: this.displaySize + "px",
										"-transform":
											"translate3d(" +
											this.offset +
											"px, 0, 0)",
									};
								case _.Y:
									return {
										height: this.displaySize + "px",
										"-transform":
											"translate3d(0, " +
											this.offset +
											"px, 0)",
									};
								default:
									return null;
							}
						}),
						t
					);
				})(),
				T = (function () {
					function t(t, e) {
						void 0 === e && (e = 0),
							(this.element = document.createElement("div")),
							(this._isShown = !1),
							(this.element.className =
								"scrollbar-track scrollbar-track-" + t),
							(this.thumb = new O(t, e)),
							this.thumb.attachTo(this.element);
					}
					return (
						(t.prototype.attachTo = function (t) {
							t.appendChild(this.element);
						}),
						(t.prototype.show = function () {
							this._isShown ||
								((this._isShown = !0),
								this.element.classList.add("show"));
						}),
						(t.prototype.hide = function () {
							this._isShown &&
								((this._isShown = !1),
								this.element.classList.remove("show"));
						}),
						(t.prototype.update = function (t, e, n) {
							v(this.element, {
								display: n <= e ? "none" : "block",
							}),
								this.thumb.update(t, e, n);
						}),
						t
					);
				})(),
				A = (function () {
					function t(t) {
						this._scrollbar = t;
						var e = t.options.thumbMinSize;
						(this.xAxis = new T(_.X, e)),
							(this.yAxis = new T(_.Y, e)),
							this.xAxis.attachTo(t.containerEl),
							this.yAxis.attachTo(t.containerEl),
							t.options.alwaysShowTracks &&
								(this.xAxis.show(), this.yAxis.show());
					}
					return (
						(t.prototype.update = function () {
							var t = this._scrollbar,
								e = t.size,
								n = t.offset;
							this.xAxis.update(
								n.x,
								e.container.width,
								e.content.width
							),
								this.yAxis.update(
									n.y,
									e.container.height,
									e.content.height
								);
						}),
						(t.prototype.autoHideOnIdle = function () {
							this._scrollbar.options.alwaysShowTracks ||
								(this.xAxis.hide(), this.yAxis.hide());
						}),
						u([S(300)], t.prototype, "autoHideOnIdle", null),
						t
					);
				})(),
				P = new WeakMap();
			function j(t) {
				return Math.pow(t - 1, 3) + 1;
			}
			var M,
				k,
				D,
				z = (function () {
					function t(t, e) {
						var n = this.constructor;
						(this.scrollbar = t),
							(this.name = n.pluginName),
							(this.options = i(i({}, n.defaultOptions), e));
					}
					return (
						(t.prototype.onInit = function () {}),
						(t.prototype.onDestroy = function () {}),
						(t.prototype.onUpdate = function () {}),
						(t.prototype.onRender = function (t) {}),
						(t.prototype.transformDelta = function (t, e) {
							return i({}, t);
						}),
						(t.pluginName = ""),
						(t.defaultOptions = {}),
						t
					);
				})(),
				L = { order: new Set(), constructors: {} };
			function I(t) {
				var e = f(t),
					n = t.containerEl;
				e(n, "keydown", function (e) {
					var r = document.activeElement;
					if (
						(r === n || n.contains(r)) &&
						!(function (t) {
							return (
								!(
									"INPUT" !== t.tagName &&
									"SELECT" !== t.tagName &&
									"TEXTAREA" !== t.tagName &&
									!t.isContentEditable
								) && !t.disabled
							);
						})(r)
					) {
						var o = (function (t, e) {
							var n = t.size,
								r = t.limit,
								o = t.offset;
							switch (e) {
								case M.TAB:
									return (function (t) {
										requestAnimationFrame(function () {
											t.scrollIntoView(
												document.activeElement,
												{
													offsetTop:
														t.size.container
															.height / 2,
													offsetLeft:
														t.size.container.width /
														2,
													onlyScrollIfNeeded: !0,
												}
											);
										});
									})(t);
								case M.SPACE:
									return [0, 200];
								case M.PAGE_UP:
									return [0, 40 - n.container.height];
								case M.PAGE_DOWN:
									return [0, n.container.height - 40];
								case M.END:
									return [0, r.y - o.y];
								case M.HOME:
									return [0, -o.y];
								case M.LEFT:
									return [-40, 0];
								case M.UP:
									return [0, -40];
								case M.RIGHT:
									return [40, 0];
								case M.DOWN:
									return [0, 40];
								default:
									return null;
							}
						})(t, e.keyCode || e.which);
						if (o) {
							var i = o[0],
								u = o[1];
							t.addTransformableMomentum(i, u, e, function (n) {
								n
									? e.preventDefault()
									: (t.containerEl.blur(),
									  t.parent && t.parent.containerEl.focus());
							});
						}
					}
				});
			}
			function R(t) {
				var e,
					n,
					r,
					o,
					i,
					u = f(t),
					c = t.containerEl,
					a = t.track,
					s = a.xAxis,
					h = a.yAxis;
				function d(e, n) {
					var r = t.size,
						o = t.limit,
						i = t.offset;
					return e === k.X
						? g(
								(n /
									(r.container.width +
										(s.thumb.realSize -
											s.thumb.displaySize))) *
									r.content.width,
								0,
								o.x
						  ) - i.x
						: e === k.Y
						? g(
								(n /
									(r.container.height +
										(h.thumb.realSize -
											h.thumb.displaySize))) *
									r.content.height,
								0,
								o.y
						  ) - i.y
						: 0;
				}
				function y(t) {
					return p(t, [s.element, s.thumb.element])
						? k.X
						: p(t, [h.element, h.thumb.element])
						? k.Y
						: void 0;
				}
				u(c, "click", function (e) {
					if (!n && p(e.target, [s.element, h.element])) {
						var r = e.target,
							o = y(r),
							i = r.getBoundingClientRect(),
							u = l(e);
						if (o === k.X) {
							var c = u.x - i.left - s.thumb.displaySize / 2;
							t.setMomentum(d(o, c), 0);
						}
						o === k.Y &&
							((c = u.y - i.top - h.thumb.displaySize / 2),
							t.setMomentum(0, d(o, c)));
					}
				}),
					u(c, "mousedown", function (n) {
						if (p(n.target, [s.thumb.element, h.thumb.element])) {
							e = !0;
							var u = n.target,
								a = l(n),
								f = u.getBoundingClientRect();
							(o = y(u)),
								(r = { x: a.x - f.left, y: a.y - f.top }),
								(i = c.getBoundingClientRect()),
								v(t.containerEl, { "-user-select": "none" });
						}
					}),
					u(window, "mousemove", function (u) {
						if (e) {
							n = !0;
							var c = l(u);
							if (o === k.X) {
								var a = c.x - r.x - i.left;
								t.setMomentum(d(o, a), 0);
							}
							o === k.Y &&
								((a = c.y - r.y - i.top),
								t.setMomentum(0, d(o, a)));
						}
					}),
					u(window, "mouseup blur", function () {
						(e = n = !1), v(t.containerEl, { "-user-select": "" });
					});
			}
			function C(t) {
				f(t)(window, "resize", x(t.update.bind(t), 300));
			}
			function N(t) {
				var e,
					n = f(t),
					r = t.containerEl,
					o = t.contentEl,
					i = !1,
					u = !1;
				n(window, "mousemove", function (n) {
					i &&
						(cancelAnimationFrame(e),
						(function n(r) {
							var o = r.x,
								i = r.y;
							if (o || i) {
								var u = t.offset,
									c = t.limit;
								t.setMomentum(
									g(u.x + o, 0, c.x) - u.x,
									g(u.y + i, 0, c.y) - u.y
								),
									(e = requestAnimationFrame(function () {
										n({ x: o, y: i });
									}));
							}
						})(
							(function (t, e) {
								var n = t.bounding,
									r = n.top,
									o = n.right,
									i = n.bottom,
									u = n.left,
									c = l(e),
									a = c.x,
									s = c.y,
									f = { x: 0, y: 0 };
								return (
									(0 === a && 0 === s) ||
										(a > o - 20
											? (f.x = a - o + 20)
											: a < u + 20 && (f.x = a - u - 20),
										s > i - 20
											? (f.y = s - i + 20)
											: s < r + 20 && (f.y = s - r - 20),
										(f.x *= 2),
										(f.y *= 2)),
									f
								);
							})(t, n)
						));
				}),
					n(o, "contextmenu", function () {
						(u = !0), cancelAnimationFrame(e), (i = !1);
					}),
					n(o, "mousedown", function () {
						u = !1;
					}),
					n(o, "selectstart", function () {
						u || (cancelAnimationFrame(e), (i = !0));
					}),
					n(window, "mouseup blur", function () {
						cancelAnimationFrame(e), (i = !1), (u = !1);
					}),
					n(r, "scroll", function (t) {
						t.preventDefault(), (r.scrollTop = r.scrollLeft = 0);
					});
			}
			function F(t) {
				var e,
					n = t.options.delegateTo || t.containerEl,
					r = new m(),
					o = f(t),
					i = 0;
				o(n, "touchstart", function (n) {
					r.track(n),
						t.setMomentum(0, 0),
						0 === i &&
							((e = t.options.damping),
							(t.options.damping = Math.max(e, 0.5))),
						i++;
				}),
					o(n, "touchmove", function (e) {
						if (!D || D === t) {
							r.update(e);
							var n = r.getDelta(),
								o = n.x,
								i = n.y;
							t.addTransformableMomentum(o, i, e, function (n) {
								n &&
									e.cancelable &&
									(e.preventDefault(), (D = t));
							});
						}
					}),
					o(n, "touchcancel touchend", function (n) {
						var o = r.getEasingDistance(e);
						t.addTransformableMomentum(o.x, o.y, n),
							0 == --i && (t.options.damping = e),
							r.release(n),
							(D = null);
					});
			}
			function H(t) {
				f(t)(
					t.options.delegateTo || t.containerEl,
					"onwheel" in window ||
						document.implementation.hasFeature(
							"Events.wheel",
							"3.0"
						)
						? "wheel"
						: "mousewheel",
					function (e) {
						var n = (function (t) {
								if ("deltaX" in t) {
									var e = G(t.deltaMode);
									return {
										x: (t.deltaX / W.STANDARD) * e,
										y: (t.deltaY / W.STANDARD) * e,
									};
								}
								return "wheelDeltaX" in t
									? {
											x: t.wheelDeltaX / W.OTHERS,
											y: t.wheelDeltaY / W.OTHERS,
									  }
									: { x: 0, y: t.wheelDelta / W.OTHERS };
							})(e),
							r = n.x,
							o = n.y;
						t.addTransformableMomentum(r, o, e, function (t) {
							t && e.preventDefault();
						});
					}
				);
			}
			!(function (t) {
				(t[(t.TAB = 9)] = "TAB"),
					(t[(t.SPACE = 32)] = "SPACE"),
					(t[(t.PAGE_UP = 33)] = "PAGE_UP"),
					(t[(t.PAGE_DOWN = 34)] = "PAGE_DOWN"),
					(t[(t.END = 35)] = "END"),
					(t[(t.HOME = 36)] = "HOME"),
					(t[(t.LEFT = 37)] = "LEFT"),
					(t[(t.UP = 38)] = "UP"),
					(t[(t.RIGHT = 39)] = "RIGHT"),
					(t[(t.DOWN = 40)] = "DOWN");
			})(M || (M = {})),
				(function (t) {
					(t[(t.X = 0)] = "X"), (t[(t.Y = 1)] = "Y");
				})(k || (k = {}));
			var W = { STANDARD: 1, OTHERS: -3 },
				B = [1, 28, 500],
				G = function (t) {
					return B[t] || B[0];
				},
				X = new Map(),
				U = (function () {
					function t(t, e) {
						var n = this;
						(this.offset = { x: 0, y: 0 }),
							(this.limit = { x: 1 / 0, y: 1 / 0 }),
							(this.bounding = {
								top: 0,
								right: 0,
								bottom: 0,
								left: 0,
							}),
							(this._plugins = []),
							(this._momentum = { x: 0, y: 0 }),
							(this._listeners = new Set()),
							(this.containerEl = t);
						var r = (this.contentEl =
							document.createElement("div"));
						(this.options = new E(e)),
							t.setAttribute("data-scrollbar", "true"),
							t.setAttribute("tabindex", "-1"),
							v(t, { overflow: "hidden", outline: "none" }),
							window.navigator.msPointerEnabled &&
								(t.style.msTouchAction = "none"),
							(r.className = "scroll-content"),
							Array.from(t.childNodes).forEach(function (t) {
								r.appendChild(t);
							}),
							t.appendChild(r),
							(this.track = new A(this)),
							(this.size = this.getSize()),
							(this._plugins = (function (t, e) {
								return Array.from(L.order)
									.filter(function (t) {
										return !1 !== e[t];
									})
									.map(function (n) {
										var r = new (0, L.constructors[n])(
											t,
											e[n]
										);
										return (e[n] = r.options), r;
									});
							})(this, this.options.plugins));
						var o = t.scrollLeft,
							i = t.scrollTop;
						(t.scrollLeft = t.scrollTop = 0),
							this.setPosition(o, i, { withoutCallbacks: !0 });
						var u = window.ResizeObserver;
						"function" == typeof u &&
							((this._observer = new u(function () {
								n.update();
							})),
							this._observer.observe(r)),
							X.set(t, this),
							requestAnimationFrame(function () {
								n._init();
							});
					}
					return (
						Object.defineProperty(t.prototype, "parent", {
							get: function () {
								for (
									var t = this.containerEl.parentElement;
									t;

								) {
									var e = X.get(t);
									if (e) return e;
									t = t.parentElement;
								}
								return null;
							},
							enumerable: !0,
							configurable: !0,
						}),
						Object.defineProperty(t.prototype, "scrollTop", {
							get: function () {
								return this.offset.y;
							},
							set: function (t) {
								this.setPosition(this.scrollLeft, t);
							},
							enumerable: !0,
							configurable: !0,
						}),
						Object.defineProperty(t.prototype, "scrollLeft", {
							get: function () {
								return this.offset.x;
							},
							set: function (t) {
								this.setPosition(t, this.scrollTop);
							},
							enumerable: !0,
							configurable: !0,
						}),
						(t.prototype.getSize = function () {
							return (function (t) {
								var e = t.containerEl,
									n = t.contentEl,
									r = getComputedStyle(e),
									o = [
										"paddingTop",
										"paddingBottom",
										"paddingLeft",
										"paddingRight",
									].map(function (t) {
										return r[t] ? parseFloat(r[t]) : 0;
									}),
									i = o[0] + o[1],
									u = o[2] + o[3];
								return {
									container: {
										width: e.clientWidth,
										height: e.clientHeight,
									},
									content: {
										width:
											n.offsetWidth -
											n.clientWidth +
											n.scrollWidth +
											u,
										height:
											n.offsetHeight -
											n.clientHeight +
											n.scrollHeight +
											i,
									},
								};
							})(this);
						}),
						(t.prototype.update = function () {
							!(function (t) {
								var e = t.getSize(),
									n = {
										x: Math.max(
											e.content.width - e.container.width,
											0
										),
										y: Math.max(
											e.content.height -
												e.container.height,
											0
										),
									},
									r = t.containerEl.getBoundingClientRect(),
									o = {
										top: Math.max(r.top, 0),
										right: Math.min(
											r.right,
											window.innerWidth
										),
										bottom: Math.min(
											r.bottom,
											window.innerHeight
										),
										left: Math.max(r.left, 0),
									};
								(t.size = e),
									(t.limit = n),
									(t.bounding = o),
									t.track.update(),
									t.setPosition();
							})(this),
								this._plugins.forEach(function (t) {
									t.onUpdate();
								});
						}),
						(t.prototype.isVisible = function (t) {
							return (function (t, e) {
								var n = t.bounding,
									r = e.getBoundingClientRect(),
									o = Math.max(n.top, r.top),
									i = Math.max(n.left, r.left),
									u = Math.min(n.right, r.right);
								return (
									o < Math.min(n.bottom, r.bottom) && i < u
								);
							})(this, t);
						}),
						(t.prototype.setPosition = function (t, e, n) {
							var r = this;
							void 0 === t && (t = this.offset.x),
								void 0 === e && (e = this.offset.y),
								void 0 === n && (n = {});
							var o = (function (t, e, n) {
								var r = t.options,
									o = t.offset,
									u = t.limit,
									c = t.track,
									a = t.contentEl;
								return (
									r.renderByPixels &&
										((e = Math.round(e)),
										(n = Math.round(n))),
									(e = g(e, 0, u.x)),
									(n = g(n, 0, u.y)),
									e !== o.x && c.xAxis.show(),
									n !== o.y && c.yAxis.show(),
									r.alwaysShowTracks || c.autoHideOnIdle(),
									e === o.x && n === o.y
										? null
										: ((o.x = e),
										  (o.y = n),
										  v(a, {
												"-transform":
													"translate3d(" +
													-e +
													"px, " +
													-n +
													"px, 0)",
										  }),
										  c.update(),
										  { offset: i({}, o), limit: i({}, u) })
								);
							})(this, t, e);
							o &&
								!n.withoutCallbacks &&
								this._listeners.forEach(function (t) {
									t.call(r, o);
								});
						}),
						(t.prototype.scrollTo = function (t, e, n, r) {
							void 0 === t && (t = this.offset.x),
								void 0 === e && (e = this.offset.y),
								void 0 === n && (n = 0),
								void 0 === r && (r = {}),
								(function (t, e, n, r, o) {
									void 0 === r && (r = 0);
									var i = void 0 === o ? {} : o,
										u = i.easing,
										c = void 0 === u ? j : u,
										a = i.callback,
										s = t.options,
										f = t.offset,
										l = t.limit;
									s.renderByPixels &&
										((e = Math.round(e)),
										(n = Math.round(n)));
									var p = f.x,
										h = f.y,
										d = g(e, 0, l.x) - p,
										v = g(n, 0, l.y) - h,
										y = Date.now();
									cancelAnimationFrame(P.get(t)),
										(function e() {
											var n = Date.now() - y,
												o = r
													? c(Math.min(n / r, 1))
													: 1;
											if (
												(t.setPosition(
													p + d * o,
													h + v * o
												),
												n >= r)
											)
												"function" == typeof a &&
													a.call(t);
											else {
												var i =
													requestAnimationFrame(e);
												P.set(t, i);
											}
										})();
								})(this, t, e, n, r);
						}),
						(t.prototype.scrollIntoView = function (t, e) {
							void 0 === e && (e = {}),
								(function (t, e, n) {
									var r = void 0 === n ? {} : n,
										o = r.alignToTop,
										i = void 0 === o || o,
										u = r.onlyScrollIfNeeded,
										c = void 0 !== u && u,
										a = r.offsetTop,
										s = void 0 === a ? 0 : a,
										f = r.offsetLeft,
										l = void 0 === f ? 0 : f,
										p = r.offsetBottom,
										h = void 0 === p ? 0 : p,
										d = t.containerEl,
										v = t.bounding,
										y = t.offset,
										m = t.limit;
									if (e && d.contains(e)) {
										var x = e.getBoundingClientRect();
										if (!c || !t.isVisible(e)) {
											var b = i
												? x.top - v.top - s
												: x.bottom - v.bottom + h;
											t.setMomentum(
												x.left - v.left - l,
												g(b, -y.y, m.y - y.y)
											);
										}
									}
								})(this, t, e);
						}),
						(t.prototype.addListener = function (t) {
							if ("function" != typeof t)
								throw new TypeError(
									"[smooth-scrollbar] scrolling listener should be a function"
								);
							this._listeners.add(t);
						}),
						(t.prototype.removeListener = function (t) {
							this._listeners.delete(t);
						}),
						(t.prototype.addTransformableMomentum = function (
							t,
							e,
							n,
							r
						) {
							this._updateDebounced();
							var o = this._plugins.reduce(
									function (t, e) {
										return e.transformDelta(t, n) || t;
									},
									{ x: t, y: e }
								),
								i = !this._shouldPropagateMomentum(o.x, o.y);
							i && this.addMomentum(o.x, o.y),
								r && r.call(this, i);
						}),
						(t.prototype.addMomentum = function (t, e) {
							this.setMomentum(
								this._momentum.x + t,
								this._momentum.y + e
							);
						}),
						(t.prototype.setMomentum = function (t, e) {
							0 === this.limit.x && (t = 0),
								0 === this.limit.y && (e = 0),
								this.options.renderByPixels &&
									((t = Math.round(t)), (e = Math.round(e))),
								(this._momentum.x = t),
								(this._momentum.y = e);
						}),
						(t.prototype.updatePluginOptions = function (t, e) {
							this._plugins.forEach(function (n) {
								n.name === t && Object.assign(n.options, e);
							});
						}),
						(t.prototype.destroy = function () {
							var t = this.containerEl,
								e = this.contentEl;
							!(function (t) {
								var e = a.get(t);
								e &&
									(e.forEach(function (t) {
										var e = t.elem,
											n = t.eventName,
											r = t.handler;
										e.removeEventListener(n, r, s());
									}),
									a.delete(t));
							})(this),
								this._listeners.clear(),
								this.setMomentum(0, 0),
								cancelAnimationFrame(this._renderID),
								this._observer && this._observer.disconnect(),
								X.delete(this.containerEl);
							for (
								var n = Array.from(e.childNodes);
								t.firstChild;

							)
								t.removeChild(t.firstChild);
							n.forEach(function (e) {
								t.appendChild(e);
							}),
								v(t, { overflow: "" }),
								(t.scrollTop = this.scrollTop),
								(t.scrollLeft = this.scrollLeft),
								this._plugins.forEach(function (t) {
									t.onDestroy();
								}),
								(this._plugins.length = 0);
						}),
						(t.prototype._init = function () {
							var t = this;
							this.update(),
								Object.keys(r).forEach(function (e) {
									r[e](t);
								}),
								this._plugins.forEach(function (t) {
									t.onInit();
								}),
								this._render();
						}),
						(t.prototype._updateDebounced = function () {
							this.update();
						}),
						(t.prototype._shouldPropagateMomentum = function (
							t,
							e
						) {
							void 0 === t && (t = 0), void 0 === e && (e = 0);
							var n = this.options,
								r = this.offset,
								o = this.limit;
							if (!n.continuousScrolling) return !1;
							0 === o.x && 0 === o.y && this._updateDebounced();
							var i = g(t + r.x, 0, o.x),
								u = g(e + r.y, 0, o.y),
								c = !0;
							return (
								(c = (c = c && i === r.x) && u === r.y) &&
								(r.x === o.x ||
									0 === r.x ||
									r.y === o.y ||
									0 === r.y)
							);
						}),
						(t.prototype._render = function () {
							var t = this._momentum;
							if (t.x || t.y) {
								var e = this._nextTick("x"),
									n = this._nextTick("y");
								(t.x = e.momentum),
									(t.y = n.momentum),
									this.setPosition(e.position, n.position);
							}
							var r = i({}, this._momentum);
							this._plugins.forEach(function (t) {
								t.onRender(r);
							}),
								(this._renderID = requestAnimationFrame(
									this._render.bind(this)
								));
						}),
						(t.prototype._nextTick = function (t) {
							var e = this.options,
								n = this.offset,
								r = this._momentum,
								o = n[t],
								i = r[t];
							if (Math.abs(i) <= 0.1)
								return { momentum: 0, position: o + i };
							var u = i * (1 - e.damping);
							return (
								e.renderByPixels && (u |= 0),
								{ momentum: u, position: o + i - u }
							);
						}),
						u([S(100, !0)], t.prototype, "_updateDebounced", null),
						t
					);
				})(),
				V = "smooth-scrollbar-style",
				Y = !1;
			function q() {
				if (!Y && "undefined" != typeof window) {
					var t = document.createElement("style");
					(t.id = V),
						(t.textContent =
							"\n[data-scrollbar] {\n  display: block;\n  position: relative;\n}\n\n.scroll-content {\n  display: flow-root;\n  -webkit-transform: translate3d(0, 0, 0);\n          transform: translate3d(0, 0, 0);\n}\n\n.scrollbar-track {\n  position: absolute;\n  opacity: 0;\n  z-index: 1;\n  background: rgba(222, 222, 222, .75);\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n  -webkit-transition: opacity 0.5s 0.5s ease-out;\n          transition: opacity 0.5s 0.5s ease-out;\n}\n.scrollbar-track.show,\n.scrollbar-track:hover {\n  opacity: 1;\n  -webkit-transition-delay: 0s;\n          transition-delay: 0s;\n}\n\n.scrollbar-track-x {\n  bottom: 0;\n  left: 0;\n  width: 100%;\n  height: 8px;\n}\n.scrollbar-track-y {\n  top: 0;\n  right: 0;\n  width: 8px;\n  height: 100%;\n}\n.scrollbar-thumb {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 8px;\n  height: 8px;\n  background: rgba(0, 0, 0, .5);\n  border-radius: 4px;\n}\n"),
						document.head && document.head.appendChild(t),
						(Y = !0);
				}
			}
			n.d(e, "ScrollbarPlugin", function () {
				return z;
			});
			var Q = (function (t) {
				function e() {
					return (null !== t && t.apply(this, arguments)) || this;
				}
				return (
					(function (t, e) {
						function n() {
							this.constructor = t;
						}
						o(t, e),
							(t.prototype =
								null === e
									? Object.create(e)
									: ((n.prototype = e.prototype), new n()));
					})(e, t),
					(e.init = function (t, e) {
						if (!t || 1 !== t.nodeType)
							throw new TypeError(
								"expect element to be DOM Element, but got " + t
							);
						return q(), X.has(t) ? X.get(t) : new U(t, e);
					}),
					(e.initAll = function (t) {
						return Array.from(
							document.querySelectorAll("[data-scrollbar]"),
							function (n) {
								return e.init(n, t);
							}
						);
					}),
					(e.has = function (t) {
						return X.has(t);
					}),
					(e.get = function (t) {
						return X.get(t);
					}),
					(e.getAll = function () {
						return Array.from(X.values());
					}),
					(e.destroy = function (t) {
						var e = X.get(t);
						e && e.destroy();
					}),
					(e.destroyAll = function () {
						X.forEach(function (t) {
							t.destroy();
						});
					}),
					(e.use = function () {
						for (var t = [], e = 0; e < arguments.length; e++)
							t[e] = arguments[e];
						return function () {
							for (var t = [], e = 0; e < arguments.length; e++)
								t[e] = arguments[e];
							t.forEach(function (t) {
								var e = t.pluginName;
								if (!e)
									throw new TypeError(
										"plugin name is required"
									);
								L.order.add(e), (L.constructors[e] = t);
							});
						}.apply(void 0, t);
					}),
					(e.attachStyle = function () {
						return q();
					}),
					(e.detachStyle = function () {
						return (function () {
							if (Y && "undefined" != typeof window) {
								var t = document.getElementById(V);
								t &&
									t.parentNode &&
									(t.parentNode.removeChild(t), (Y = !1));
							}
						})();
					}),
					(e.version = "8.8.4"),
					(e.ScrollbarPlugin = z),
					e
				);
			})(U);
			e.default = Q;
		},
	]).default;
});

/*!
 * Masonry PACKAGED v4.2.2
 * Cascading grid layout library
 * https://masonry.desandro.com
 * MIT License
 * by David DeSandro
 */

!function(t,e){"function"==typeof define&&define.amd?define("jquery-bridget/jquery-bridget",["jquery"],function(i){return e(t,i)}):"object"==typeof module&&module.exports?module.exports=e(t,require("jquery")):t.jQueryBridget=e(t,t.jQuery)}(window,function(t,e){"use strict";function i(i,r,a){function h(t,e,n){var o,r="$()."+i+'("'+e+'")';return t.each(function(t,h){var u=a.data(h,i);if(!u)return void s(i+" not initialized. Cannot call methods, i.e. "+r);var d=u[e];if(!d||"_"==e.charAt(0))return void s(r+" is not a valid method");var l=d.apply(u,n);o=void 0===o?l:o}),void 0!==o?o:t}function u(t,e){t.each(function(t,n){var o=a.data(n,i);o?(o.option(e),o._init()):(o=new r(n,e),a.data(n,i,o))})}a=a||e||t.jQuery,a&&(r.prototype.option||(r.prototype.option=function(t){a.isPlainObject(t)&&(this.options=a.extend(!0,this.options,t))}),a.fn[i]=function(t){if("string"==typeof t){var e=o.call(arguments,1);return h(this,t,e)}return u(this,t),this},n(a))}function n(t){!t||t&&t.bridget||(t.bridget=i)}var o=Array.prototype.slice,r=t.console,s="undefined"==typeof r?function(){}:function(t){r.error(t)};return n(e||t.jQuery),i}),function(t,e){"function"==typeof define&&define.amd?define("ev-emitter/ev-emitter",e):"object"==typeof module&&module.exports?module.exports=e():t.EvEmitter=e()}("undefined"!=typeof window?window:this,function(){function t(){}var e=t.prototype;return e.on=function(t,e){if(t&&e){var i=this._events=this._events||{},n=i[t]=i[t]||[];return-1==n.indexOf(e)&&n.push(e),this}},e.once=function(t,e){if(t&&e){this.on(t,e);var i=this._onceEvents=this._onceEvents||{},n=i[t]=i[t]||{};return n[e]=!0,this}},e.off=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){var n=i.indexOf(e);return-1!=n&&i.splice(n,1),this}},e.emitEvent=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){i=i.slice(0),e=e||[];for(var n=this._onceEvents&&this._onceEvents[t],o=0;o<i.length;o++){var r=i[o],s=n&&n[r];s&&(this.off(t,r),delete n[r]),r.apply(this,e)}return this}},e.allOff=function(){delete this._events,delete this._onceEvents},t}),function(t,e){"function"==typeof define&&define.amd?define("get-size/get-size",e):"object"==typeof module&&module.exports?module.exports=e():t.getSize=e()}(window,function(){"use strict";function t(t){var e=parseFloat(t),i=-1==t.indexOf("%")&&!isNaN(e);return i&&e}function e(){}function i(){for(var t={width:0,height:0,innerWidth:0,innerHeight:0,outerWidth:0,outerHeight:0},e=0;u>e;e++){var i=h[e];t[i]=0}return t}function n(t){var e=getComputedStyle(t);return e||a("Style returned "+e+". Are you running this code in a hidden iframe on Firefox? See https://bit.ly/getsizebug1"),e}function o(){if(!d){d=!0;var e=document.createElement("div");e.style.width="200px",e.style.padding="1px 2px 3px 4px",e.style.borderStyle="solid",e.style.borderWidth="1px 2px 3px 4px",e.style.boxSizing="border-box";var i=document.body||document.documentElement;i.appendChild(e);var o=n(e);s=200==Math.round(t(o.width)),r.isBoxSizeOuter=s,i.removeChild(e)}}function r(e){if(o(),"string"==typeof e&&(e=document.querySelector(e)),e&&"object"==typeof e&&e.nodeType){var r=n(e);if("none"==r.display)return i();var a={};a.width=e.offsetWidth,a.height=e.offsetHeight;for(var d=a.isBorderBox="border-box"==r.boxSizing,l=0;u>l;l++){var c=h[l],f=r[c],m=parseFloat(f);a[c]=isNaN(m)?0:m}var p=a.paddingLeft+a.paddingRight,g=a.paddingTop+a.paddingBottom,y=a.marginLeft+a.marginRight,v=a.marginTop+a.marginBottom,_=a.borderLeftWidth+a.borderRightWidth,z=a.borderTopWidth+a.borderBottomWidth,E=d&&s,b=t(r.width);b!==!1&&(a.width=b+(E?0:p+_));var x=t(r.height);return x!==!1&&(a.height=x+(E?0:g+z)),a.innerWidth=a.width-(p+_),a.innerHeight=a.height-(g+z),a.outerWidth=a.width+y,a.outerHeight=a.height+v,a}}var s,a="undefined"==typeof console?e:function(t){console.error(t)},h=["paddingLeft","paddingRight","paddingTop","paddingBottom","marginLeft","marginRight","marginTop","marginBottom","borderLeftWidth","borderRightWidth","borderTopWidth","borderBottomWidth"],u=h.length,d=!1;return r}),function(t,e){"use strict";"function"==typeof define&&define.amd?define("desandro-matches-selector/matches-selector",e):"object"==typeof module&&module.exports?module.exports=e():t.matchesSelector=e()}(window,function(){"use strict";var t=function(){var t=window.Element.prototype;if(t.matches)return"matches";if(t.matchesSelector)return"matchesSelector";for(var e=["webkit","moz","ms","o"],i=0;i<e.length;i++){var n=e[i],o=n+"MatchesSelector";if(t[o])return o}}();return function(e,i){return e[t](i)}}),function(t,e){"function"==typeof define&&define.amd?define("fizzy-ui-utils/utils",["desandro-matches-selector/matches-selector"],function(i){return e(t,i)}):"object"==typeof module&&module.exports?module.exports=e(t,require("desandro-matches-selector")):t.fizzyUIUtils=e(t,t.matchesSelector)}(window,function(t,e){var i={};i.extend=function(t,e){for(var i in e)t[i]=e[i];return t},i.modulo=function(t,e){return(t%e+e)%e};var n=Array.prototype.slice;i.makeArray=function(t){if(Array.isArray(t))return t;if(null===t||void 0===t)return[];var e="object"==typeof t&&"number"==typeof t.length;return e?n.call(t):[t]},i.removeFrom=function(t,e){var i=t.indexOf(e);-1!=i&&t.splice(i,1)},i.getParent=function(t,i){for(;t.parentNode&&t!=document.body;)if(t=t.parentNode,e(t,i))return t},i.getQueryElement=function(t){return"string"==typeof t?document.querySelector(t):t},i.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},i.filterFindElements=function(t,n){t=i.makeArray(t);var o=[];return t.forEach(function(t){if(t instanceof HTMLElement){if(!n)return void o.push(t);e(t,n)&&o.push(t);for(var i=t.querySelectorAll(n),r=0;r<i.length;r++)o.push(i[r])}}),o},i.debounceMethod=function(t,e,i){i=i||100;var n=t.prototype[e],o=e+"Timeout";t.prototype[e]=function(){var t=this[o];clearTimeout(t);var e=arguments,r=this;this[o]=setTimeout(function(){n.apply(r,e),delete r[o]},i)}},i.docReady=function(t){var e=document.readyState;"complete"==e||"interactive"==e?setTimeout(t):document.addEventListener("DOMContentLoaded",t)},i.toDashed=function(t){return t.replace(/(.)([A-Z])/g,function(t,e,i){return e+"-"+i}).toLowerCase()};var o=t.console;return i.htmlInit=function(e,n){i.docReady(function(){var r=i.toDashed(n),s="data-"+r,a=document.querySelectorAll("["+s+"]"),h=document.querySelectorAll(".js-"+r),u=i.makeArray(a).concat(i.makeArray(h)),d=s+"-options",l=t.jQuery;u.forEach(function(t){var i,r=t.getAttribute(s)||t.getAttribute(d);try{i=r&&JSON.parse(r)}catch(a){return void(o&&o.error("Error parsing "+s+" on "+t.className+": "+a))}var h=new e(t,i);l&&l.data(t,n,h)})})},i}),function(t,e){"function"==typeof define&&define.amd?define("outlayer/item",["ev-emitter/ev-emitter","get-size/get-size"],e):"object"==typeof module&&module.exports?module.exports=e(require("ev-emitter"),require("get-size")):(t.Outlayer={},t.Outlayer.Item=e(t.EvEmitter,t.getSize))}(window,function(t,e){"use strict";function i(t){for(var e in t)return!1;return e=null,!0}function n(t,e){t&&(this.element=t,this.layout=e,this.position={x:0,y:0},this._create())}function o(t){return t.replace(/([A-Z])/g,function(t){return"-"+t.toLowerCase()})}var r=document.documentElement.style,s="string"==typeof r.transition?"transition":"WebkitTransition",a="string"==typeof r.transform?"transform":"WebkitTransform",h={WebkitTransition:"webkitTransitionEnd",transition:"transitionend"}[s],u={transform:a,transition:s,transitionDuration:s+"Duration",transitionProperty:s+"Property",transitionDelay:s+"Delay"},d=n.prototype=Object.create(t.prototype);d.constructor=n,d._create=function(){this._transn={ingProperties:{},clean:{},onEnd:{}},this.css({position:"absolute"})},d.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},d.getSize=function(){this.size=e(this.element)},d.css=function(t){var e=this.element.style;for(var i in t){var n=u[i]||i;e[n]=t[i]}},d.getPosition=function(){var t=getComputedStyle(this.element),e=this.layout._getOption("originLeft"),i=this.layout._getOption("originTop"),n=t[e?"left":"right"],o=t[i?"top":"bottom"],r=parseFloat(n),s=parseFloat(o),a=this.layout.size;-1!=n.indexOf("%")&&(r=r/100*a.width),-1!=o.indexOf("%")&&(s=s/100*a.height),r=isNaN(r)?0:r,s=isNaN(s)?0:s,r-=e?a.paddingLeft:a.paddingRight,s-=i?a.paddingTop:a.paddingBottom,this.position.x=r,this.position.y=s},d.layoutPosition=function(){var t=this.layout.size,e={},i=this.layout._getOption("originLeft"),n=this.layout._getOption("originTop"),o=i?"paddingLeft":"paddingRight",r=i?"left":"right",s=i?"right":"left",a=this.position.x+t[o];e[r]=this.getXValue(a),e[s]="";var h=n?"paddingTop":"paddingBottom",u=n?"top":"bottom",d=n?"bottom":"top",l=this.position.y+t[h];e[u]=this.getYValue(l),e[d]="",this.css(e),this.emitEvent("layout",[this])},d.getXValue=function(t){var e=this.layout._getOption("horizontal");return this.layout.options.percentPosition&&!e?t/this.layout.size.width*100+"%":t+"px"},d.getYValue=function(t){var e=this.layout._getOption("horizontal");return this.layout.options.percentPosition&&e?t/this.layout.size.height*100+"%":t+"px"},d._transitionTo=function(t,e){this.getPosition();var i=this.position.x,n=this.position.y,o=t==this.position.x&&e==this.position.y;if(this.setPosition(t,e),o&&!this.isTransitioning)return void this.layoutPosition();var r=t-i,s=e-n,a={};a.transform=this.getTranslate(r,s),this.transition({to:a,onTransitionEnd:{transform:this.layoutPosition},isCleaning:!0})},d.getTranslate=function(t,e){var i=this.layout._getOption("originLeft"),n=this.layout._getOption("originTop");return t=i?t:-t,e=n?e:-e,"translate3d("+t+"px, "+e+"px, 0)"},d.goTo=function(t,e){this.setPosition(t,e),this.layoutPosition()},d.moveTo=d._transitionTo,d.setPosition=function(t,e){this.position.x=parseFloat(t),this.position.y=parseFloat(e)},d._nonTransition=function(t){this.css(t.to),t.isCleaning&&this._removeStyles(t.to);for(var e in t.onTransitionEnd)t.onTransitionEnd[e].call(this)},d.transition=function(t){if(!parseFloat(this.layout.options.transitionDuration))return void this._nonTransition(t);var e=this._transn;for(var i in t.onTransitionEnd)e.onEnd[i]=t.onTransitionEnd[i];for(i in t.to)e.ingProperties[i]=!0,t.isCleaning&&(e.clean[i]=!0);if(t.from){this.css(t.from);var n=this.element.offsetHeight;n=null}this.enableTransition(t.to),this.css(t.to),this.isTransitioning=!0};var l="opacity,"+o(a);d.enableTransition=function(){if(!this.isTransitioning){var t=this.layout.options.transitionDuration;t="number"==typeof t?t+"ms":t,this.css({transitionProperty:l,transitionDuration:t,transitionDelay:this.staggerDelay||0}),this.element.addEventListener(h,this,!1)}},d.onwebkitTransitionEnd=function(t){this.ontransitionend(t)},d.onotransitionend=function(t){this.ontransitionend(t)};var c={"-webkit-transform":"transform"};d.ontransitionend=function(t){if(t.target===this.element){var e=this._transn,n=c[t.propertyName]||t.propertyName;if(delete e.ingProperties[n],i(e.ingProperties)&&this.disableTransition(),n in e.clean&&(this.element.style[t.propertyName]="",delete e.clean[n]),n in e.onEnd){var o=e.onEnd[n];o.call(this),delete e.onEnd[n]}this.emitEvent("transitionEnd",[this])}},d.disableTransition=function(){this.removeTransitionStyles(),this.element.removeEventListener(h,this,!1),this.isTransitioning=!1},d._removeStyles=function(t){var e={};for(var i in t)e[i]="";this.css(e)};var f={transitionProperty:"",transitionDuration:"",transitionDelay:""};return d.removeTransitionStyles=function(){this.css(f)},d.stagger=function(t){t=isNaN(t)?0:t,this.staggerDelay=t+"ms"},d.removeElem=function(){this.element.parentNode.removeChild(this.element),this.css({display:""}),this.emitEvent("remove",[this])},d.remove=function(){return s&&parseFloat(this.layout.options.transitionDuration)?(this.once("transitionEnd",function(){this.removeElem()}),void this.hide()):void this.removeElem()},d.reveal=function(){delete this.isHidden,this.css({display:""});var t=this.layout.options,e={},i=this.getHideRevealTransitionEndProperty("visibleStyle");e[i]=this.onRevealTransitionEnd,this.transition({from:t.hiddenStyle,to:t.visibleStyle,isCleaning:!0,onTransitionEnd:e})},d.onRevealTransitionEnd=function(){this.isHidden||this.emitEvent("reveal")},d.getHideRevealTransitionEndProperty=function(t){var e=this.layout.options[t];if(e.opacity)return"opacity";for(var i in e)return i},d.hide=function(){this.isHidden=!0,this.css({display:""});var t=this.layout.options,e={},i=this.getHideRevealTransitionEndProperty("hiddenStyle");e[i]=this.onHideTransitionEnd,this.transition({from:t.visibleStyle,to:t.hiddenStyle,isCleaning:!0,onTransitionEnd:e})},d.onHideTransitionEnd=function(){this.isHidden&&(this.css({display:"none"}),this.emitEvent("hide"))},d.destroy=function(){this.css({position:"",left:"",right:"",top:"",bottom:"",transition:"",transform:""})},n}),function(t,e){"use strict";"function"==typeof define&&define.amd?define("outlayer/outlayer",["ev-emitter/ev-emitter","get-size/get-size","fizzy-ui-utils/utils","./item"],function(i,n,o,r){return e(t,i,n,o,r)}):"object"==typeof module&&module.exports?module.exports=e(t,require("ev-emitter"),require("get-size"),require("fizzy-ui-utils"),require("./item")):t.Outlayer=e(t,t.EvEmitter,t.getSize,t.fizzyUIUtils,t.Outlayer.Item)}(window,function(t,e,i,n,o){"use strict";function r(t,e){var i=n.getQueryElement(t);if(!i)return void(h&&h.error("Bad element for "+this.constructor.namespace+": "+(i||t)));this.element=i,u&&(this.$element=u(this.element)),this.options=n.extend({},this.constructor.defaults),this.option(e);var o=++l;this.element.outlayerGUID=o,c[o]=this,this._create();var r=this._getOption("initLayout");r&&this.layout()}function s(t){function e(){t.apply(this,arguments)}return e.prototype=Object.create(t.prototype),e.prototype.constructor=e,e}function a(t){if("number"==typeof t)return t;var e=t.match(/(^\d*\.?\d*)(\w*)/),i=e&&e[1],n=e&&e[2];if(!i.length)return 0;i=parseFloat(i);var o=m[n]||1;return i*o}var h=t.console,u=t.jQuery,d=function(){},l=0,c={};r.namespace="outlayer",r.Item=o,r.defaults={containerStyle:{position:"relative"},initLayout:!0,originLeft:!0,originTop:!0,resize:!0,resizeContainer:!0,transitionDuration:"0.4s",hiddenStyle:{opacity:0,transform:"scale(0.001)"},visibleStyle:{opacity:1,transform:"scale(1)"}};var f=r.prototype;n.extend(f,e.prototype),f.option=function(t){n.extend(this.options,t)},f._getOption=function(t){var e=this.constructor.compatOptions[t];return e&&void 0!==this.options[e]?this.options[e]:this.options[t]},r.compatOptions={initLayout:"isInitLayout",horizontal:"isHorizontal",layoutInstant:"isLayoutInstant",originLeft:"isOriginLeft",originTop:"isOriginTop",resize:"isResizeBound",resizeContainer:"isResizingContainer"},f._create=function(){this.reloadItems(),this.stamps=[],this.stamp(this.options.stamp),n.extend(this.element.style,this.options.containerStyle);var t=this._getOption("resize");t&&this.bindResize()},f.reloadItems=function(){this.items=this._itemize(this.element.children)},f._itemize=function(t){for(var e=this._filterFindItemElements(t),i=this.constructor.Item,n=[],o=0;o<e.length;o++){var r=e[o],s=new i(r,this);n.push(s)}return n},f._filterFindItemElements=function(t){return n.filterFindElements(t,this.options.itemSelector)},f.getItemElements=function(){return this.items.map(function(t){return t.element})},f.layout=function(){this._resetLayout(),this._manageStamps();var t=this._getOption("layoutInstant"),e=void 0!==t?t:!this._isLayoutInited;this.layoutItems(this.items,e),this._isLayoutInited=!0},f._init=f.layout,f._resetLayout=function(){this.getSize()},f.getSize=function(){this.size=i(this.element)},f._getMeasurement=function(t,e){var n,o=this.options[t];o?("string"==typeof o?n=this.element.querySelector(o):o instanceof HTMLElement&&(n=o),this[t]=n?i(n)[e]:o):this[t]=0},f.layoutItems=function(t,e){t=this._getItemsForLayout(t),this._layoutItems(t,e),this._postLayout()},f._getItemsForLayout=function(t){return t.filter(function(t){return!t.isIgnored})},f._layoutItems=function(t,e){if(this._emitCompleteOnItems("layout",t),t&&t.length){var i=[];t.forEach(function(t){var n=this._getItemLayoutPosition(t);n.item=t,n.isInstant=e||t.isLayoutInstant,i.push(n)},this),this._processLayoutQueue(i)}},f._getItemLayoutPosition=function(){return{x:0,y:0}},f._processLayoutQueue=function(t){this.updateStagger(),t.forEach(function(t,e){this._positionItem(t.item,t.x,t.y,t.isInstant,e)},this)},f.updateStagger=function(){var t=this.options.stagger;return null===t||void 0===t?void(this.stagger=0):(this.stagger=a(t),this.stagger)},f._positionItem=function(t,e,i,n,o){n?t.goTo(e,i):(t.stagger(o*this.stagger),t.moveTo(e,i))},f._postLayout=function(){this.resizeContainer()},f.resizeContainer=function(){var t=this._getOption("resizeContainer");if(t){var e=this._getContainerSize();e&&(this._setContainerMeasure(e.width,!0),this._setContainerMeasure(e.height,!1))}},f._getContainerSize=d,f._setContainerMeasure=function(t,e){if(void 0!==t){var i=this.size;i.isBorderBox&&(t+=e?i.paddingLeft+i.paddingRight+i.borderLeftWidth+i.borderRightWidth:i.paddingBottom+i.paddingTop+i.borderTopWidth+i.borderBottomWidth),t=Math.max(t,0),this.element.style[e?"width":"height"]=t+"px"}},f._emitCompleteOnItems=function(t,e){function i(){o.dispatchEvent(t+"Complete",null,[e])}function n(){s++,s==r&&i()}var o=this,r=e.length;if(!e||!r)return void i();var s=0;e.forEach(function(e){e.once(t,n)})},f.dispatchEvent=function(t,e,i){var n=e?[e].concat(i):i;if(this.emitEvent(t,n),u)if(this.$element=this.$element||u(this.element),e){var o=u.Event(e);o.type=t,this.$element.trigger(o,i)}else this.$element.trigger(t,i)},f.ignore=function(t){var e=this.getItem(t);e&&(e.isIgnored=!0)},f.unignore=function(t){var e=this.getItem(t);e&&delete e.isIgnored},f.stamp=function(t){t=this._find(t),t&&(this.stamps=this.stamps.concat(t),t.forEach(this.ignore,this))},f.unstamp=function(t){t=this._find(t),t&&t.forEach(function(t){n.removeFrom(this.stamps,t),this.unignore(t)},this)},f._find=function(t){return t?("string"==typeof t&&(t=this.element.querySelectorAll(t)),t=n.makeArray(t)):void 0},f._manageStamps=function(){this.stamps&&this.stamps.length&&(this._getBoundingRect(),this.stamps.forEach(this._manageStamp,this))},f._getBoundingRect=function(){var t=this.element.getBoundingClientRect(),e=this.size;this._boundingRect={left:t.left+e.paddingLeft+e.borderLeftWidth,top:t.top+e.paddingTop+e.borderTopWidth,right:t.right-(e.paddingRight+e.borderRightWidth),bottom:t.bottom-(e.paddingBottom+e.borderBottomWidth)}},f._manageStamp=d,f._getElementOffset=function(t){var e=t.getBoundingClientRect(),n=this._boundingRect,o=i(t),r={left:e.left-n.left-o.marginLeft,top:e.top-n.top-o.marginTop,right:n.right-e.right-o.marginRight,bottom:n.bottom-e.bottom-o.marginBottom};return r},f.handleEvent=n.handleEvent,f.bindResize=function(){t.addEventListener("resize",this),this.isResizeBound=!0},f.unbindResize=function(){t.removeEventListener("resize",this),this.isResizeBound=!1},f.onresize=function(){this.resize()},n.debounceMethod(r,"onresize",100),f.resize=function(){this.isResizeBound&&this.needsResizeLayout()&&this.layout()},f.needsResizeLayout=function(){var t=i(this.element),e=this.size&&t;return e&&t.innerWidth!==this.size.innerWidth},f.addItems=function(t){var e=this._itemize(t);return e.length&&(this.items=this.items.concat(e)),e},f.appended=function(t){var e=this.addItems(t);e.length&&(this.layoutItems(e,!0),this.reveal(e))},f.prepended=function(t){var e=this._itemize(t);if(e.length){var i=this.items.slice(0);this.items=e.concat(i),this._resetLayout(),this._manageStamps(),this.layoutItems(e,!0),this.reveal(e),this.layoutItems(i)}},f.reveal=function(t){if(this._emitCompleteOnItems("reveal",t),t&&t.length){var e=this.updateStagger();t.forEach(function(t,i){t.stagger(i*e),t.reveal()})}},f.hide=function(t){if(this._emitCompleteOnItems("hide",t),t&&t.length){var e=this.updateStagger();t.forEach(function(t,i){t.stagger(i*e),t.hide()})}},f.revealItemElements=function(t){var e=this.getItems(t);this.reveal(e)},f.hideItemElements=function(t){var e=this.getItems(t);this.hide(e)},f.getItem=function(t){for(var e=0;e<this.items.length;e++){var i=this.items[e];if(i.element==t)return i}},f.getItems=function(t){t=n.makeArray(t);var e=[];return t.forEach(function(t){var i=this.getItem(t);i&&e.push(i)},this),e},f.remove=function(t){var e=this.getItems(t);this._emitCompleteOnItems("remove",e),e&&e.length&&e.forEach(function(t){t.remove(),n.removeFrom(this.items,t)},this)},f.destroy=function(){var t=this.element.style;t.height="",t.position="",t.width="",this.items.forEach(function(t){t.destroy()}),this.unbindResize();var e=this.element.outlayerGUID;delete c[e],delete this.element.outlayerGUID,u&&u.removeData(this.element,this.constructor.namespace)},r.data=function(t){t=n.getQueryElement(t);var e=t&&t.outlayerGUID;return e&&c[e]},r.create=function(t,e){var i=s(r);return i.defaults=n.extend({},r.defaults),n.extend(i.defaults,e),i.compatOptions=n.extend({},r.compatOptions),i.namespace=t,i.data=r.data,i.Item=s(o),n.htmlInit(i,t),u&&u.bridget&&u.bridget(t,i),i};var m={ms:1,s:1e3};return r.Item=o,r}),function(t,e){"function"==typeof define&&define.amd?define(["outlayer/outlayer","get-size/get-size"],e):"object"==typeof module&&module.exports?module.exports=e(require("outlayer"),require("get-size")):t.Masonry=e(t.Outlayer,t.getSize)}(window,function(t,e){var i=t.create("masonry");i.compatOptions.fitWidth="isFitWidth";var n=i.prototype;return n._resetLayout=function(){this.getSize(),this._getMeasurement("columnWidth","outerWidth"),this._getMeasurement("gutter","outerWidth"),this.measureColumns(),this.colYs=[];for(var t=0;t<this.cols;t++)this.colYs.push(0);this.maxY=0,this.horizontalColIndex=0},n.measureColumns=function(){if(this.getContainerWidth(),!this.columnWidth){var t=this.items[0],i=t&&t.element;this.columnWidth=i&&e(i).outerWidth||this.containerWidth}var n=this.columnWidth+=this.gutter,o=this.containerWidth+this.gutter,r=o/n,s=n-o%n,a=s&&1>s?"round":"floor";r=Math[a](r),this.cols=Math.max(r,1)},n.getContainerWidth=function(){var t=this._getOption("fitWidth"),i=t?this.element.parentNode:this.element,n=e(i);this.containerWidth=n&&n.innerWidth},n._getItemLayoutPosition=function(t){t.getSize();var e=t.size.outerWidth%this.columnWidth,i=e&&1>e?"round":"ceil",n=Math[i](t.size.outerWidth/this.columnWidth);n=Math.min(n,this.cols);for(var o=this.options.horizontalOrder?"_getHorizontalColPosition":"_getTopColPosition",r=this[o](n,t),s={x:this.columnWidth*r.col,y:r.y},a=r.y+t.size.outerHeight,h=n+r.col,u=r.col;h>u;u++)this.colYs[u]=a;return s},n._getTopColPosition=function(t){var e=this._getTopColGroup(t),i=Math.min.apply(Math,e);return{col:e.indexOf(i),y:i}},n._getTopColGroup=function(t){if(2>t)return this.colYs;for(var e=[],i=this.cols+1-t,n=0;i>n;n++)e[n]=this._getColGroupY(n,t);return e},n._getColGroupY=function(t,e){if(2>e)return this.colYs[t];var i=this.colYs.slice(t,t+e);return Math.max.apply(Math,i)},n._getHorizontalColPosition=function(t,e){var i=this.horizontalColIndex%this.cols,n=t>1&&i+t>this.cols;i=n?0:i;var o=e.size.outerWidth&&e.size.outerHeight;return this.horizontalColIndex=o?i+t:this.horizontalColIndex,{col:i,y:this._getColGroupY(i,t)}},n._manageStamp=function(t){var i=e(t),n=this._getElementOffset(t),o=this._getOption("originLeft"),r=o?n.left:n.right,s=r+i.outerWidth,a=Math.floor(r/this.columnWidth);a=Math.max(0,a);var h=Math.floor(s/this.columnWidth);h-=s%this.columnWidth?0:1,h=Math.min(this.cols-1,h);for(var u=this._getOption("originTop"),d=(u?n.top:n.bottom)+i.outerHeight,l=a;h>=l;l++)this.colYs[l]=Math.max(d,this.colYs[l])},n._getContainerSize=function(){this.maxY=Math.max.apply(Math,this.colYs);var t={height:this.maxY};return this._getOption("fitWidth")&&(t.width=this._getContainerFitWidth()),t},n._getContainerFitWidth=function(){for(var t=0,e=this.cols;--e&&0===this.colYs[e];)t++;return(this.cols-t)*this.columnWidth-this.gutter},n.needsResizeLayout=function(){var t=this.containerWidth;return this.getContainerWidth(),t!=this.containerWidth},i});
/**
 * Swiper 9.4.1
 * Most modern mobile touch slider and framework with hardware accelerated transitions
 * https://swiperjs.com
 *
 * Copyright 2014-2023 Vladimir Kharlampidi
 *
 * Released under the MIT License
 *
 * Released on: June 13, 2023
 */

!(function (e, t) {
	"object" == typeof exports && "undefined" != typeof module
		? (module.exports = t())
		: "function" == typeof define && define.amd
		? define(t)
		: ((e =
				"undefined" != typeof globalThis
					? globalThis
					: e || self).Swiper = t());
})(this, function () {
	"use strict";
	function e(e) {
		return (
			null !== e &&
			"object" == typeof e &&
			"constructor" in e &&
			e.constructor === Object
		);
	}
	function t(s, a) {
		void 0 === s && (s = {}),
			void 0 === a && (a = {}),
			Object.keys(a).forEach((i) => {
				void 0 === s[i]
					? (s[i] = a[i])
					: e(a[i]) &&
					  e(s[i]) &&
					  Object.keys(a[i]).length > 0 &&
					  t(s[i], a[i]);
			});
	}
	const s = {
		body: {},
		addEventListener() {},
		removeEventListener() {},
		activeElement: { blur() {}, nodeName: "" },
		querySelector: () => null,
		querySelectorAll: () => [],
		getElementById: () => null,
		createEvent: () => ({ initEvent() {} }),
		createElement: () => ({
			children: [],
			childNodes: [],
			style: {},
			setAttribute() {},
			getElementsByTagName: () => [],
		}),
		createElementNS: () => ({}),
		importNode: () => null,
		location: {
			hash: "",
			host: "",
			hostname: "",
			href: "",
			origin: "",
			pathname: "",
			protocol: "",
			search: "",
		},
	};
	function a() {
		const e = "undefined" != typeof document ? document : {};
		return t(e, s), e;
	}
	const i = {
		document: s,
		navigator: { userAgent: "" },
		location: {
			hash: "",
			host: "",
			hostname: "",
			href: "",
			origin: "",
			pathname: "",
			protocol: "",
			search: "",
		},
		history: { replaceState() {}, pushState() {}, go() {}, back() {} },
		CustomEvent: function () {
			return this;
		},
		addEventListener() {},
		removeEventListener() {},
		getComputedStyle: () => ({ getPropertyValue: () => "" }),
		Image() {},
		Date() {},
		screen: {},
		setTimeout() {},
		clearTimeout() {},
		matchMedia: () => ({}),
		requestAnimationFrame: (e) =>
			"undefined" == typeof setTimeout ? (e(), null) : setTimeout(e, 0),
		cancelAnimationFrame(e) {
			"undefined" != typeof setTimeout && clearTimeout(e);
		},
	};
	function r() {
		const e = "undefined" != typeof window ? window : {};
		return t(e, i), e;
	}
	function n(e, t) {
		return void 0 === t && (t = 0), setTimeout(e, t);
	}
	function l() {
		return Date.now();
	}
	function o(e, t) {
		void 0 === t && (t = "x");
		const s = r();
		let a, i, n;
		const l = (function (e) {
			const t = r();
			let s;
			return (
				t.getComputedStyle && (s = t.getComputedStyle(e, null)),
				!s && e.currentStyle && (s = e.currentStyle),
				s || (s = e.style),
				s
			);
		})(e);
		return (
			s.WebKitCSSMatrix
				? ((i = l.transform || l.webkitTransform),
				  i.split(",").length > 6 &&
						(i = i
							.split(", ")
							.map((e) => e.replace(",", "."))
							.join(", ")),
				  (n = new s.WebKitCSSMatrix("none" === i ? "" : i)))
				: ((n =
						l.MozTransform ||
						l.OTransform ||
						l.MsTransform ||
						l.msTransform ||
						l.transform ||
						l
							.getPropertyValue("transform")
							.replace("translate(", "matrix(1, 0, 0, 1,")),
				  (a = n.toString().split(","))),
			"x" === t &&
				(i = s.WebKitCSSMatrix
					? n.m41
					: 16 === a.length
					? parseFloat(a[12])
					: parseFloat(a[4])),
			"y" === t &&
				(i = s.WebKitCSSMatrix
					? n.m42
					: 16 === a.length
					? parseFloat(a[13])
					: parseFloat(a[5])),
			i || 0
		);
	}
	function d(e) {
		return (
			"object" == typeof e &&
			null !== e &&
			e.constructor &&
			"Object" === Object.prototype.toString.call(e).slice(8, -1)
		);
	}
	function c(e) {
		return "undefined" != typeof window && void 0 !== window.HTMLElement
			? e instanceof HTMLElement
			: e && (1 === e.nodeType || 11 === e.nodeType);
	}
	function p() {
		const e = Object(arguments.length <= 0 ? void 0 : arguments[0]),
			t = ["__proto__", "constructor", "prototype"];
		for (let s = 1; s < arguments.length; s += 1) {
			const a = s < 0 || arguments.length <= s ? void 0 : arguments[s];
			if (null != a && !c(a)) {
				const s = Object.keys(Object(a)).filter(
					(e) => t.indexOf(e) < 0
				);
				for (let t = 0, i = s.length; t < i; t += 1) {
					const i = s[t],
						r = Object.getOwnPropertyDescriptor(a, i);
					void 0 !== r &&
						r.enumerable &&
						(d(e[i]) && d(a[i])
							? a[i].__swiper__
								? (e[i] = a[i])
								: p(e[i], a[i])
							: !d(e[i]) && d(a[i])
							? ((e[i] = {}),
							  a[i].__swiper__ ? (e[i] = a[i]) : p(e[i], a[i]))
							: (e[i] = a[i]));
				}
			}
		}
		return e;
	}
	function u(e, t, s) {
		e.style.setProperty(t, s);
	}
	function m(e) {
		let { swiper: t, targetPosition: s, side: a } = e;
		const i = r(),
			n = -t.translate;
		let l,
			o = null;
		const d = t.params.speed;
		(t.wrapperEl.style.scrollSnapType = "none"),
			i.cancelAnimationFrame(t.cssModeFrameID);
		const c = s > n ? "next" : "prev",
			p = (e, t) => ("next" === c && e >= t) || ("prev" === c && e <= t),
			u = () => {
				(l = new Date().getTime()), null === o && (o = l);
				const e = Math.max(Math.min((l - o) / d, 1), 0),
					r = 0.5 - Math.cos(e * Math.PI) / 2;
				let c = n + r * (s - n);
				if (
					(p(c, s) && (c = s),
					t.wrapperEl.scrollTo({ [a]: c }),
					p(c, s))
				)
					return (
						(t.wrapperEl.style.overflow = "hidden"),
						(t.wrapperEl.style.scrollSnapType = ""),
						setTimeout(() => {
							(t.wrapperEl.style.overflow = ""),
								t.wrapperEl.scrollTo({ [a]: c });
						}),
						void i.cancelAnimationFrame(t.cssModeFrameID)
					);
				t.cssModeFrameID = i.requestAnimationFrame(u);
			};
		u();
	}
	function h(e) {
		return (
			e.querySelector(".swiper-slide-transform") ||
			(e.shadowEl &&
				e.shadowEl.querySelector(".swiper-slide-transform")) ||
			e
		);
	}
	function f(e, t) {
		return (
			void 0 === t && (t = ""),
			[...e.children].filter((e) => e.matches(t))
		);
	}
	function g(e, t) {
		void 0 === t && (t = []);
		const s = document.createElement(e);
		return s.classList.add(...(Array.isArray(t) ? t : [t])), s;
	}
	function v(e) {
		const t = r(),
			s = a(),
			i = e.getBoundingClientRect(),
			n = s.body,
			l = e.clientTop || n.clientTop || 0,
			o = e.clientLeft || n.clientLeft || 0,
			d = e === t ? t.scrollY : e.scrollTop,
			c = e === t ? t.scrollX : e.scrollLeft;
		return { top: i.top + d - l, left: i.left + c - o };
	}
	function w(e, t) {
		return r().getComputedStyle(e, null).getPropertyValue(t);
	}
	function b(e) {
		let t,
			s = e;
		if (s) {
			for (t = 0; null !== (s = s.previousSibling); )
				1 === s.nodeType && (t += 1);
			return t;
		}
	}
	function y(e, t) {
		const s = [];
		let a = e.parentElement;
		for (; a; )
			t ? a.matches(t) && s.push(a) : s.push(a), (a = a.parentElement);
		return s;
	}
	function E(e, t) {
		t &&
			e.addEventListener("transitionend", function s(a) {
				a.target === e &&
					(t.call(e, a), e.removeEventListener("transitionend", s));
			});
	}
	function x(e, t, s) {
		const a = r();
		return s
			? e["width" === t ? "offsetWidth" : "offsetHeight"] +
					parseFloat(
						a
							.getComputedStyle(e, null)
							.getPropertyValue(
								"width" === t ? "margin-right" : "margin-top"
							)
					) +
					parseFloat(
						a
							.getComputedStyle(e, null)
							.getPropertyValue(
								"width" === t ? "margin-left" : "margin-bottom"
							)
					)
			: e.offsetWidth;
	}
	let S, T, M;
	function C() {
		return (
			S ||
				(S = (function () {
					const e = r(),
						t = a();
					return {
						smoothScroll:
							t.documentElement &&
							t.documentElement.style &&
							"scrollBehavior" in t.documentElement.style,
						touch: !!(
							"ontouchstart" in e ||
							(e.DocumentTouch && t instanceof e.DocumentTouch)
						),
					};
				})()),
			S
		);
	}
	function P(e) {
		return (
			void 0 === e && (e = {}),
			T ||
				(T = (function (e) {
					let { userAgent: t } = void 0 === e ? {} : e;
					const s = C(),
						a = r(),
						i = a.navigator.platform,
						n = t || a.navigator.userAgent,
						l = { ios: !1, android: !1 },
						o = a.screen.width,
						d = a.screen.height,
						c = n.match(/(Android);?[\s\/]+([\d.]+)?/);
					let p = n.match(/(iPad).*OS\s([\d_]+)/);
					const u = n.match(/(iPod)(.*OS\s([\d_]+))?/),
						m = !p && n.match(/(iPhone\sOS|iOS)\s([\d_]+)/),
						h = "Win32" === i;
					let f = "MacIntel" === i;
					return (
						!p &&
							f &&
							s.touch &&
							[
								"1024x1366",
								"1366x1024",
								"834x1194",
								"1194x834",
								"834x1112",
								"1112x834",
								"768x1024",
								"1024x768",
								"820x1180",
								"1180x820",
								"810x1080",
								"1080x810",
							].indexOf(`${o}x${d}`) >= 0 &&
							((p = n.match(/(Version)\/([\d.]+)/)),
							p || (p = [0, 1, "13_0_0"]),
							(f = !1)),
						c && !h && ((l.os = "android"), (l.android = !0)),
						(p || m || u) && ((l.os = "ios"), (l.ios = !0)),
						l
					);
				})(e)),
			T
		);
	}
	function L() {
		return (
			M ||
				(M = (function () {
					const e = r();
					let t = !1;
					function s() {
						const t = e.navigator.userAgent.toLowerCase();
						return (
							t.indexOf("safari") >= 0 &&
							t.indexOf("chrome") < 0 &&
							t.indexOf("android") < 0
						);
					}
					if (s()) {
						const s = String(e.navigator.userAgent);
						if (s.includes("Version/")) {
							const [e, a] = s
								.split("Version/")[1]
								.split(" ")[0]
								.split(".")
								.map((e) => Number(e));
							t = e < 16 || (16 === e && a < 2);
						}
					}
					return {
						isSafari: t || s(),
						needPerspectiveFix: t,
						isWebView:
							/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(
								e.navigator.userAgent
							),
					};
				})()),
			M
		);
	}
	var z = {
		on(e, t, s) {
			const a = this;
			if (!a.eventsListeners || a.destroyed) return a;
			if ("function" != typeof t) return a;
			const i = s ? "unshift" : "push";
			return (
				e.split(" ").forEach((e) => {
					a.eventsListeners[e] || (a.eventsListeners[e] = []),
						a.eventsListeners[e][i](t);
				}),
				a
			);
		},
		once(e, t, s) {
			const a = this;
			if (!a.eventsListeners || a.destroyed) return a;
			if ("function" != typeof t) return a;
			function i() {
				a.off(e, i), i.__emitterProxy && delete i.__emitterProxy;
				for (
					var s = arguments.length, r = new Array(s), n = 0;
					n < s;
					n++
				)
					r[n] = arguments[n];
				t.apply(a, r);
			}
			return (i.__emitterProxy = t), a.on(e, i, s);
		},
		onAny(e, t) {
			const s = this;
			if (!s.eventsListeners || s.destroyed) return s;
			if ("function" != typeof e) return s;
			const a = t ? "unshift" : "push";
			return (
				s.eventsAnyListeners.indexOf(e) < 0 &&
					s.eventsAnyListeners[a](e),
				s
			);
		},
		offAny(e) {
			const t = this;
			if (!t.eventsListeners || t.destroyed) return t;
			if (!t.eventsAnyListeners) return t;
			const s = t.eventsAnyListeners.indexOf(e);
			return s >= 0 && t.eventsAnyListeners.splice(s, 1), t;
		},
		off(e, t) {
			const s = this;
			return !s.eventsListeners || s.destroyed
				? s
				: s.eventsListeners
				? (e.split(" ").forEach((e) => {
						void 0 === t
							? (s.eventsListeners[e] = [])
							: s.eventsListeners[e] &&
							  s.eventsListeners[e].forEach((a, i) => {
									(a === t ||
										(a.__emitterProxy &&
											a.__emitterProxy === t)) &&
										s.eventsListeners[e].splice(i, 1);
							  });
				  }),
				  s)
				: s;
		},
		emit() {
			const e = this;
			if (!e.eventsListeners || e.destroyed) return e;
			if (!e.eventsListeners) return e;
			let t, s, a;
			for (var i = arguments.length, r = new Array(i), n = 0; n < i; n++)
				r[n] = arguments[n];
			"string" == typeof r[0] || Array.isArray(r[0])
				? ((t = r[0]), (s = r.slice(1, r.length)), (a = e))
				: ((t = r[0].events), (s = r[0].data), (a = r[0].context || e)),
				s.unshift(a);
			return (
				(Array.isArray(t) ? t : t.split(" ")).forEach((t) => {
					e.eventsAnyListeners &&
						e.eventsAnyListeners.length &&
						e.eventsAnyListeners.forEach((e) => {
							e.apply(a, [t, ...s]);
						}),
						e.eventsListeners &&
							e.eventsListeners[t] &&
							e.eventsListeners[t].forEach((e) => {
								e.apply(a, s);
							});
				}),
				e
			);
		},
	};
	const A = (e, t) => {
			if (!e || e.destroyed || !e.params) return;
			const s = t.closest(
				e.isElement ? "swiper-slide" : `.${e.params.slideClass}`
			);
			if (s) {
				const t = s.querySelector(`.${e.params.lazyPreloaderClass}`);
				t && t.remove();
			}
		},
		$ = (e, t) => {
			if (!e.slides[t]) return;
			const s = e.slides[t].querySelector('[loading="lazy"]');
			s && s.removeAttribute("loading");
		},
		I = (e) => {
			if (!e || e.destroyed || !e.params) return;
			let t = e.params.lazyPreloadPrevNext;
			const s = e.slides.length;
			if (!s || !t || t < 0) return;
			t = Math.min(t, s);
			const a =
					"auto" === e.params.slidesPerView
						? e.slidesPerViewDynamic()
						: Math.ceil(e.params.slidesPerView),
				i = e.activeIndex;
			if (e.params.grid && e.params.grid.rows > 1) {
				const s = i,
					r = [s - t];
				return (
					r.push(
						...Array.from({ length: t }).map((e, t) => s + a + t)
					),
					void e.slides.forEach((t, s) => {
						r.includes(t.column) && $(e, s);
					})
				);
			}
			const r = i + a - 1;
			if (e.params.rewind || e.params.loop)
				for (let a = i - t; a <= r + t; a += 1) {
					const t = ((a % s) + s) % s;
					(t < i || t > r) && $(e, t);
				}
			else
				for (
					let a = Math.max(i - t, 0);
					a <= Math.min(r + t, s - 1);
					a += 1
				)
					a !== i && (a > r || a < i) && $(e, a);
		};
	var k = {
		updateSize: function () {
			const e = this;
			let t, s;
			const a = e.el;
			(t =
				void 0 !== e.params.width && null !== e.params.width
					? e.params.width
					: a.clientWidth),
				(s =
					void 0 !== e.params.height && null !== e.params.height
						? e.params.height
						: a.clientHeight),
				(0 === t && e.isHorizontal()) ||
					(0 === s && e.isVertical()) ||
					((t =
						t -
						parseInt(w(a, "padding-left") || 0, 10) -
						parseInt(w(a, "padding-right") || 0, 10)),
					(s =
						s -
						parseInt(w(a, "padding-top") || 0, 10) -
						parseInt(w(a, "padding-bottom") || 0, 10)),
					Number.isNaN(t) && (t = 0),
					Number.isNaN(s) && (s = 0),
					Object.assign(e, {
						width: t,
						height: s,
						size: e.isHorizontal() ? t : s,
					}));
		},
		updateSlides: function () {
			const e = this;
			function t(t) {
				return e.isHorizontal()
					? t
					: {
							width: "height",
							"margin-top": "margin-left",
							"margin-bottom ": "margin-right",
							"margin-left": "margin-top",
							"margin-right": "margin-bottom",
							"padding-left": "padding-top",
							"padding-right": "padding-bottom",
							marginRight: "marginBottom",
					  }[t];
			}
			function s(e, s) {
				return parseFloat(e.getPropertyValue(t(s)) || 0);
			}
			const a = e.params,
				{
					wrapperEl: i,
					slidesEl: r,
					size: n,
					rtlTranslate: l,
					wrongRTL: o,
				} = e,
				d = e.virtual && a.virtual.enabled,
				c = d ? e.virtual.slides.length : e.slides.length,
				p = f(r, `.${e.params.slideClass}, swiper-slide`),
				m = d ? e.virtual.slides.length : p.length;
			let h = [];
			const g = [],
				v = [];
			let b = a.slidesOffsetBefore;
			"function" == typeof b && (b = a.slidesOffsetBefore.call(e));
			let y = a.slidesOffsetAfter;
			"function" == typeof y && (y = a.slidesOffsetAfter.call(e));
			const E = e.snapGrid.length,
				S = e.slidesGrid.length;
			let T = a.spaceBetween,
				M = -b,
				C = 0,
				P = 0;
			if (void 0 === n) return;
			"string" == typeof T && T.indexOf("%") >= 0
				? (T = (parseFloat(T.replace("%", "")) / 100) * n)
				: "string" == typeof T && (T = parseFloat(T)),
				(e.virtualSize = -T),
				p.forEach((e) => {
					l ? (e.style.marginLeft = "") : (e.style.marginRight = ""),
						(e.style.marginBottom = ""),
						(e.style.marginTop = "");
				}),
				a.centeredSlides &&
					a.cssMode &&
					(u(i, "--swiper-centered-offset-before", ""),
					u(i, "--swiper-centered-offset-after", ""));
			const L = a.grid && a.grid.rows > 1 && e.grid;
			let z;
			L && e.grid.initSlides(m);
			const A =
				"auto" === a.slidesPerView &&
				a.breakpoints &&
				Object.keys(a.breakpoints).filter(
					(e) => void 0 !== a.breakpoints[e].slidesPerView
				).length > 0;
			for (let i = 0; i < m; i += 1) {
				let r;
				if (
					((z = 0),
					p[i] && (r = p[i]),
					L && e.grid.updateSlide(i, r, m, t),
					!p[i] || "none" !== w(r, "display"))
				) {
					if ("auto" === a.slidesPerView) {
						A && (p[i].style[t("width")] = "");
						const n = getComputedStyle(r),
							l = r.style.transform,
							o = r.style.webkitTransform;
						if (
							(l && (r.style.transform = "none"),
							o && (r.style.webkitTransform = "none"),
							a.roundLengths)
						)
							z = e.isHorizontal()
								? x(r, "width", !0)
								: x(r, "height", !0);
						else {
							const e = s(n, "width"),
								t = s(n, "padding-left"),
								a = s(n, "padding-right"),
								i = s(n, "margin-left"),
								l = s(n, "margin-right"),
								o = n.getPropertyValue("box-sizing");
							if (o && "border-box" === o) z = e + i + l;
							else {
								const { clientWidth: s, offsetWidth: n } = r;
								z = e + t + a + i + l + (n - s);
							}
						}
						l && (r.style.transform = l),
							o && (r.style.webkitTransform = o),
							a.roundLengths && (z = Math.floor(z));
					} else
						(z = (n - (a.slidesPerView - 1) * T) / a.slidesPerView),
							a.roundLengths && (z = Math.floor(z)),
							p[i] && (p[i].style[t("width")] = `${z}px`);
					p[i] && (p[i].swiperSlideSize = z),
						v.push(z),
						a.centeredSlides
							? ((M = M + z / 2 + C / 2 + T),
							  0 === C && 0 !== i && (M = M - n / 2 - T),
							  0 === i && (M = M - n / 2 - T),
							  Math.abs(M) < 0.001 && (M = 0),
							  a.roundLengths && (M = Math.floor(M)),
							  P % a.slidesPerGroup == 0 && h.push(M),
							  g.push(M))
							: (a.roundLengths && (M = Math.floor(M)),
							  (P - Math.min(e.params.slidesPerGroupSkip, P)) %
									e.params.slidesPerGroup ==
									0 && h.push(M),
							  g.push(M),
							  (M = M + z + T)),
						(e.virtualSize += z + T),
						(C = z),
						(P += 1);
				}
			}
			if (
				((e.virtualSize = Math.max(e.virtualSize, n) + y),
				l &&
					o &&
					("slide" === a.effect || "coverflow" === a.effect) &&
					(i.style.width = `${e.virtualSize + T}px`),
				a.setWrapperSize &&
					(i.style[t("width")] = `${e.virtualSize + T}px`),
				L && e.grid.updateWrapperSize(z, h, t),
				!a.centeredSlides)
			) {
				const t = [];
				for (let s = 0; s < h.length; s += 1) {
					let i = h[s];
					a.roundLengths && (i = Math.floor(i)),
						h[s] <= e.virtualSize - n && t.push(i);
				}
				(h = t),
					Math.floor(e.virtualSize - n) -
						Math.floor(h[h.length - 1]) >
						1 && h.push(e.virtualSize - n);
			}
			if (d && a.loop) {
				const t = v[0] + T;
				if (a.slidesPerGroup > 1) {
					const s = Math.ceil(
							(e.virtual.slidesBefore + e.virtual.slidesAfter) /
								a.slidesPerGroup
						),
						i = t * a.slidesPerGroup;
					for (let e = 0; e < s; e += 1) h.push(h[h.length - 1] + i);
				}
				for (
					let s = 0;
					s < e.virtual.slidesBefore + e.virtual.slidesAfter;
					s += 1
				)
					1 === a.slidesPerGroup && h.push(h[h.length - 1] + t),
						g.push(g[g.length - 1] + t),
						(e.virtualSize += t);
			}
			if ((0 === h.length && (h = [0]), 0 !== T)) {
				const s =
					e.isHorizontal() && l ? "marginLeft" : t("marginRight");
				p.filter(
					(e, t) => !(a.cssMode && !a.loop) || t !== p.length - 1
				).forEach((e) => {
					e.style[s] = `${T}px`;
				});
			}
			if (a.centeredSlides && a.centeredSlidesBounds) {
				let e = 0;
				v.forEach((t) => {
					e += t + (T || 0);
				}),
					(e -= T);
				const t = e - n;
				h = h.map((e) => (e <= 0 ? -b : e > t ? t + y : e));
			}
			if (a.centerInsufficientSlides) {
				let e = 0;
				if (
					(v.forEach((t) => {
						e += t + (T || 0);
					}),
					(e -= T),
					e < n)
				) {
					const t = (n - e) / 2;
					h.forEach((e, s) => {
						h[s] = e - t;
					}),
						g.forEach((e, s) => {
							g[s] = e + t;
						});
				}
			}
			if (
				(Object.assign(e, {
					slides: p,
					snapGrid: h,
					slidesGrid: g,
					slidesSizesGrid: v,
				}),
				a.centeredSlides && a.cssMode && !a.centeredSlidesBounds)
			) {
				u(i, "--swiper-centered-offset-before", -h[0] + "px"),
					u(
						i,
						"--swiper-centered-offset-after",
						e.size / 2 - v[v.length - 1] / 2 + "px"
					);
				const t = -e.snapGrid[0],
					s = -e.slidesGrid[0];
				(e.snapGrid = e.snapGrid.map((e) => e + t)),
					(e.slidesGrid = e.slidesGrid.map((e) => e + s));
			}
			if (
				(m !== c && e.emit("slidesLengthChange"),
				h.length !== E &&
					(e.params.watchOverflow && e.checkOverflow(),
					e.emit("snapGridLengthChange")),
				g.length !== S && e.emit("slidesGridLengthChange"),
				a.watchSlidesProgress && e.updateSlidesOffset(),
				!(
					d ||
					a.cssMode ||
					("slide" !== a.effect && "fade" !== a.effect)
				))
			) {
				const t = `${a.containerModifierClass}backface-hidden`,
					s = e.el.classList.contains(t);
				m <= a.maxBackfaceHiddenSlides
					? s || e.el.classList.add(t)
					: s && e.el.classList.remove(t);
			}
		},
		updateAutoHeight: function (e) {
			const t = this,
				s = [],
				a = t.virtual && t.params.virtual.enabled;
			let i,
				r = 0;
			"number" == typeof e
				? t.setTransition(e)
				: !0 === e && t.setTransition(t.params.speed);
			const n = (e) =>
				a ? t.slides[t.getSlideIndexByData(e)] : t.slides[e];
			if ("auto" !== t.params.slidesPerView && t.params.slidesPerView > 1)
				if (t.params.centeredSlides)
					(t.visibleSlides || []).forEach((e) => {
						s.push(e);
					});
				else
					for (i = 0; i < Math.ceil(t.params.slidesPerView); i += 1) {
						const e = t.activeIndex + i;
						if (e > t.slides.length && !a) break;
						s.push(n(e));
					}
			else s.push(n(t.activeIndex));
			for (i = 0; i < s.length; i += 1)
				if (void 0 !== s[i]) {
					const e = s[i].offsetHeight;
					r = e > r ? e : r;
				}
			(r || 0 === r) && (t.wrapperEl.style.height = `${r}px`);
		},
		updateSlidesOffset: function () {
			const e = this,
				t = e.slides,
				s = e.isElement
					? e.isHorizontal()
						? e.wrapperEl.offsetLeft
						: e.wrapperEl.offsetTop
					: 0;
			for (let a = 0; a < t.length; a += 1)
				t[a].swiperSlideOffset =
					(e.isHorizontal() ? t[a].offsetLeft : t[a].offsetTop) -
					s -
					e.cssOverflowAdjustment();
		},
		updateSlidesProgress: function (e) {
			void 0 === e && (e = (this && this.translate) || 0);
			const t = this,
				s = t.params,
				{ slides: a, rtlTranslate: i, snapGrid: r } = t;
			if (0 === a.length) return;
			void 0 === a[0].swiperSlideOffset && t.updateSlidesOffset();
			let n = -e;
			i && (n = e),
				a.forEach((e) => {
					e.classList.remove(s.slideVisibleClass);
				}),
				(t.visibleSlidesIndexes = []),
				(t.visibleSlides = []);
			let l = s.spaceBetween;
			"string" == typeof l && l.indexOf("%") >= 0
				? (l = (parseFloat(l.replace("%", "")) / 100) * t.size)
				: "string" == typeof l && (l = parseFloat(l));
			for (let e = 0; e < a.length; e += 1) {
				const o = a[e];
				let d = o.swiperSlideOffset;
				s.cssMode && s.centeredSlides && (d -= a[0].swiperSlideOffset);
				const c =
						(n + (s.centeredSlides ? t.minTranslate() : 0) - d) /
						(o.swiperSlideSize + l),
					p =
						(n -
							r[0] +
							(s.centeredSlides ? t.minTranslate() : 0) -
							d) /
						(o.swiperSlideSize + l),
					u = -(n - d),
					m = u + t.slidesSizesGrid[e];
				((u >= 0 && u < t.size - 1) ||
					(m > 1 && m <= t.size) ||
					(u <= 0 && m >= t.size)) &&
					(t.visibleSlides.push(o),
					t.visibleSlidesIndexes.push(e),
					a[e].classList.add(s.slideVisibleClass)),
					(o.progress = i ? -c : c),
					(o.originalProgress = i ? -p : p);
			}
		},
		updateProgress: function (e) {
			const t = this;
			if (void 0 === e) {
				const s = t.rtlTranslate ? -1 : 1;
				e = (t && t.translate && t.translate * s) || 0;
			}
			const s = t.params,
				a = t.maxTranslate() - t.minTranslate();
			let { progress: i, isBeginning: r, isEnd: n, progressLoop: l } = t;
			const o = r,
				d = n;
			if (0 === a) (i = 0), (r = !0), (n = !0);
			else {
				i = (e - t.minTranslate()) / a;
				const s = Math.abs(e - t.minTranslate()) < 1,
					l = Math.abs(e - t.maxTranslate()) < 1;
				(r = s || i <= 0),
					(n = l || i >= 1),
					s && (i = 0),
					l && (i = 1);
			}
			if (s.loop) {
				const s = t.getSlideIndexByData(0),
					a = t.getSlideIndexByData(t.slides.length - 1),
					i = t.slidesGrid[s],
					r = t.slidesGrid[a],
					n = t.slidesGrid[t.slidesGrid.length - 1],
					o = Math.abs(e);
				(l = o >= i ? (o - i) / n : (o + n - r) / n), l > 1 && (l -= 1);
			}
			Object.assign(t, {
				progress: i,
				progressLoop: l,
				isBeginning: r,
				isEnd: n,
			}),
				(s.watchSlidesProgress || (s.centeredSlides && s.autoHeight)) &&
					t.updateSlidesProgress(e),
				r && !o && t.emit("reachBeginning toEdge"),
				n && !d && t.emit("reachEnd toEdge"),
				((o && !r) || (d && !n)) && t.emit("fromEdge"),
				t.emit("progress", i);
		},
		updateSlidesClasses: function () {
			const e = this,
				{ slides: t, params: s, slidesEl: a, activeIndex: i } = e,
				r = e.virtual && s.virtual.enabled,
				n = (e) => f(a, `.${s.slideClass}${e}, swiper-slide${e}`)[0];
			let l;
			if (
				(t.forEach((e) => {
					e.classList.remove(
						s.slideActiveClass,
						s.slideNextClass,
						s.slidePrevClass
					);
				}),
				r)
			)
				if (s.loop) {
					let t = i - e.virtual.slidesBefore;
					t < 0 && (t = e.virtual.slides.length + t),
						t >= e.virtual.slides.length &&
							(t -= e.virtual.slides.length),
						(l = n(`[data-swiper-slide-index="${t}"]`));
				} else l = n(`[data-swiper-slide-index="${i}"]`);
			else l = t[i];
			if (l) {
				l.classList.add(s.slideActiveClass);
				let e = (function (e, t) {
					const s = [];
					for (; e.nextElementSibling; ) {
						const a = e.nextElementSibling;
						t ? a.matches(t) && s.push(a) : s.push(a), (e = a);
					}
					return s;
				})(l, `.${s.slideClass}, swiper-slide`)[0];
				s.loop && !e && (e = t[0]),
					e && e.classList.add(s.slideNextClass);
				let a = (function (e, t) {
					const s = [];
					for (; e.previousElementSibling; ) {
						const a = e.previousElementSibling;
						t ? a.matches(t) && s.push(a) : s.push(a), (e = a);
					}
					return s;
				})(l, `.${s.slideClass}, swiper-slide`)[0];
				s.loop && 0 === !a && (a = t[t.length - 1]),
					a && a.classList.add(s.slidePrevClass);
			}
			e.emitSlidesClasses();
		},
		updateActiveIndex: function (e) {
			const t = this,
				s = t.rtlTranslate ? t.translate : -t.translate,
				{
					snapGrid: a,
					params: i,
					activeIndex: r,
					realIndex: n,
					snapIndex: l,
				} = t;
			let o,
				d = e;
			const c = (e) => {
				let s = e - t.virtual.slidesBefore;
				return (
					s < 0 && (s = t.virtual.slides.length + s),
					s >= t.virtual.slides.length &&
						(s -= t.virtual.slides.length),
					s
				);
			};
			if (
				(void 0 === d &&
					(d = (function (e) {
						const { slidesGrid: t, params: s } = e,
							a = e.rtlTranslate ? e.translate : -e.translate;
						let i;
						for (let e = 0; e < t.length; e += 1)
							void 0 !== t[e + 1]
								? a >= t[e] &&
								  a < t[e + 1] - (t[e + 1] - t[e]) / 2
									? (i = e)
									: a >= t[e] && a < t[e + 1] && (i = e + 1)
								: a >= t[e] && (i = e);
						return (
							s.normalizeSlideIndex &&
								(i < 0 || void 0 === i) &&
								(i = 0),
							i
						);
					})(t)),
				a.indexOf(s) >= 0)
			)
				o = a.indexOf(s);
			else {
				const e = Math.min(i.slidesPerGroupSkip, d);
				o = e + Math.floor((d - e) / i.slidesPerGroup);
			}
			if ((o >= a.length && (o = a.length - 1), d === r))
				return (
					o !== l && ((t.snapIndex = o), t.emit("snapIndexChange")),
					void (
						t.params.loop &&
						t.virtual &&
						t.params.virtual.enabled &&
						(t.realIndex = c(d))
					)
				);
			let p;
			(p =
				t.virtual && i.virtual.enabled && i.loop
					? c(d)
					: t.slides[d]
					? parseInt(
							t.slides[d].getAttribute(
								"data-swiper-slide-index"
							) || d,
							10
					  )
					: d),
				Object.assign(t, {
					previousSnapIndex: l,
					snapIndex: o,
					previousRealIndex: n,
					realIndex: p,
					previousIndex: r,
					activeIndex: d,
				}),
				t.initialized && I(t),
				t.emit("activeIndexChange"),
				t.emit("snapIndexChange"),
				n !== p && t.emit("realIndexChange"),
				(t.initialized || t.params.runCallbacksOnInit) &&
					t.emit("slideChange");
		},
		updateClickedSlide: function (e) {
			const t = this,
				s = t.params,
				a = e.closest(`.${s.slideClass}, swiper-slide`);
			let i,
				r = !1;
			if (a)
				for (let e = 0; e < t.slides.length; e += 1)
					if (t.slides[e] === a) {
						(r = !0), (i = e);
						break;
					}
			if (!a || !r)
				return (
					(t.clickedSlide = void 0), void (t.clickedIndex = void 0)
				);
			(t.clickedSlide = a),
				t.virtual && t.params.virtual.enabled
					? (t.clickedIndex = parseInt(
							a.getAttribute("data-swiper-slide-index"),
							10
					  ))
					: (t.clickedIndex = i),
				s.slideToClickedSlide &&
					void 0 !== t.clickedIndex &&
					t.clickedIndex !== t.activeIndex &&
					t.slideToClickedSlide();
		},
	};
	var O = {
		getTranslate: function (e) {
			void 0 === e && (e = this.isHorizontal() ? "x" : "y");
			const {
				params: t,
				rtlTranslate: s,
				translate: a,
				wrapperEl: i,
			} = this;
			if (t.virtualTranslate) return s ? -a : a;
			if (t.cssMode) return a;
			let r = o(i, e);
			return (r += this.cssOverflowAdjustment()), s && (r = -r), r || 0;
		},
		setTranslate: function (e, t) {
			const s = this,
				{ rtlTranslate: a, params: i, wrapperEl: r, progress: n } = s;
			let l,
				o = 0,
				d = 0;
			s.isHorizontal() ? (o = a ? -e : e) : (d = e),
				i.roundLengths && ((o = Math.floor(o)), (d = Math.floor(d))),
				(s.previousTranslate = s.translate),
				(s.translate = s.isHorizontal() ? o : d),
				i.cssMode
					? (r[s.isHorizontal() ? "scrollLeft" : "scrollTop"] =
							s.isHorizontal() ? -o : -d)
					: i.virtualTranslate ||
					  (s.isHorizontal()
							? (o -= s.cssOverflowAdjustment())
							: (d -= s.cssOverflowAdjustment()),
					  (r.style.transform = `translate3d(${o}px, ${d}px, 0px)`));
			const c = s.maxTranslate() - s.minTranslate();
			(l = 0 === c ? 0 : (e - s.minTranslate()) / c),
				l !== n && s.updateProgress(e),
				s.emit("setTranslate", s.translate, t);
		},
		minTranslate: function () {
			return -this.snapGrid[0];
		},
		maxTranslate: function () {
			return -this.snapGrid[this.snapGrid.length - 1];
		},
		translateTo: function (e, t, s, a, i) {
			void 0 === e && (e = 0),
				void 0 === t && (t = this.params.speed),
				void 0 === s && (s = !0),
				void 0 === a && (a = !0);
			const r = this,
				{ params: n, wrapperEl: l } = r;
			if (r.animating && n.preventInteractionOnTransition) return !1;
			const o = r.minTranslate(),
				d = r.maxTranslate();
			let c;
			if (
				((c = a && e > o ? o : a && e < d ? d : e),
				r.updateProgress(c),
				n.cssMode)
			) {
				const e = r.isHorizontal();
				if (0 === t) l[e ? "scrollLeft" : "scrollTop"] = -c;
				else {
					if (!r.support.smoothScroll)
						return (
							m({
								swiper: r,
								targetPosition: -c,
								side: e ? "left" : "top",
							}),
							!0
						);
					l.scrollTo({
						[e ? "left" : "top"]: -c,
						behavior: "smooth",
					});
				}
				return !0;
			}
			return (
				0 === t
					? (r.setTransition(0),
					  r.setTranslate(c),
					  s &&
							(r.emit("beforeTransitionStart", t, i),
							r.emit("transitionEnd")))
					: (r.setTransition(t),
					  r.setTranslate(c),
					  s &&
							(r.emit("beforeTransitionStart", t, i),
							r.emit("transitionStart")),
					  r.animating ||
							((r.animating = !0),
							r.onTranslateToWrapperTransitionEnd ||
								(r.onTranslateToWrapperTransitionEnd =
									function (e) {
										r &&
											!r.destroyed &&
											e.target === this &&
											(r.wrapperEl.removeEventListener(
												"transitionend",
												r.onTranslateToWrapperTransitionEnd
											),
											(r.onTranslateToWrapperTransitionEnd =
												null),
											delete r.onTranslateToWrapperTransitionEnd,
											s && r.emit("transitionEnd"));
									}),
							r.wrapperEl.addEventListener(
								"transitionend",
								r.onTranslateToWrapperTransitionEnd
							))),
				!0
			);
		},
	};
	function D(e) {
		let { swiper: t, runCallbacks: s, direction: a, step: i } = e;
		const { activeIndex: r, previousIndex: n } = t;
		let l = a;
		if (
			(l || (l = r > n ? "next" : r < n ? "prev" : "reset"),
			t.emit(`transition${i}`),
			s && r !== n)
		) {
			if ("reset" === l) return void t.emit(`slideResetTransition${i}`);
			t.emit(`slideChangeTransition${i}`),
				"next" === l
					? t.emit(`slideNextTransition${i}`)
					: t.emit(`slidePrevTransition${i}`);
		}
	}
	var G = {
		slideTo: function (e, t, s, a, i) {
			void 0 === e && (e = 0),
				void 0 === t && (t = this.params.speed),
				void 0 === s && (s = !0),
				"string" == typeof e && (e = parseInt(e, 10));
			const r = this;
			let n = e;
			n < 0 && (n = 0);
			const {
				params: l,
				snapGrid: o,
				slidesGrid: d,
				previousIndex: c,
				activeIndex: p,
				rtlTranslate: u,
				wrapperEl: h,
				enabled: f,
			} = r;
			if (
				(r.animating && l.preventInteractionOnTransition) ||
				(!f && !a && !i)
			)
				return !1;
			const g = Math.min(r.params.slidesPerGroupSkip, n);
			let v = g + Math.floor((n - g) / r.params.slidesPerGroup);
			v >= o.length && (v = o.length - 1);
			const w = -o[v];
			if (l.normalizeSlideIndex)
				for (let e = 0; e < d.length; e += 1) {
					const t = -Math.floor(100 * w),
						s = Math.floor(100 * d[e]),
						a = Math.floor(100 * d[e + 1]);
					void 0 !== d[e + 1]
						? t >= s && t < a - (a - s) / 2
							? (n = e)
							: t >= s && t < a && (n = e + 1)
						: t >= s && (n = e);
				}
			if (r.initialized && n !== p) {
				if (
					!r.allowSlideNext &&
					(u
						? w > r.translate && w > r.minTranslate()
						: w < r.translate && w < r.minTranslate())
				)
					return !1;
				if (
					!r.allowSlidePrev &&
					w > r.translate &&
					w > r.maxTranslate() &&
					(p || 0) !== n
				)
					return !1;
			}
			let b;
			if (
				(n !== (c || 0) && s && r.emit("beforeSlideChangeStart"),
				r.updateProgress(w),
				(b = n > p ? "next" : n < p ? "prev" : "reset"),
				(u && -w === r.translate) || (!u && w === r.translate))
			)
				return (
					r.updateActiveIndex(n),
					l.autoHeight && r.updateAutoHeight(),
					r.updateSlidesClasses(),
					"slide" !== l.effect && r.setTranslate(w),
					"reset" !== b &&
						(r.transitionStart(s, b), r.transitionEnd(s, b)),
					!1
				);
			if (l.cssMode) {
				const e = r.isHorizontal(),
					s = u ? w : -w;
				if (0 === t) {
					const t = r.virtual && r.params.virtual.enabled;
					t &&
						((r.wrapperEl.style.scrollSnapType = "none"),
						(r._immediateVirtual = !0)),
						t &&
						!r._cssModeVirtualInitialSet &&
						r.params.initialSlide > 0
							? ((r._cssModeVirtualInitialSet = !0),
							  requestAnimationFrame(() => {
									h[e ? "scrollLeft" : "scrollTop"] = s;
							  }))
							: (h[e ? "scrollLeft" : "scrollTop"] = s),
						t &&
							requestAnimationFrame(() => {
								(r.wrapperEl.style.scrollSnapType = ""),
									(r._immediateVirtual = !1);
							});
				} else {
					if (!r.support.smoothScroll)
						return (
							m({
								swiper: r,
								targetPosition: s,
								side: e ? "left" : "top",
							}),
							!0
						);
					h.scrollTo({ [e ? "left" : "top"]: s, behavior: "smooth" });
				}
				return !0;
			}
			return (
				r.setTransition(t),
				r.setTranslate(w),
				r.updateActiveIndex(n),
				r.updateSlidesClasses(),
				r.emit("beforeTransitionStart", t, a),
				r.transitionStart(s, b),
				0 === t
					? r.transitionEnd(s, b)
					: r.animating ||
					  ((r.animating = !0),
					  r.onSlideToWrapperTransitionEnd ||
							(r.onSlideToWrapperTransitionEnd = function (e) {
								r &&
									!r.destroyed &&
									e.target === this &&
									(r.wrapperEl.removeEventListener(
										"transitionend",
										r.onSlideToWrapperTransitionEnd
									),
									(r.onSlideToWrapperTransitionEnd = null),
									delete r.onSlideToWrapperTransitionEnd,
									r.transitionEnd(s, b));
							}),
					  r.wrapperEl.addEventListener(
							"transitionend",
							r.onSlideToWrapperTransitionEnd
					  )),
				!0
			);
		},
		slideToLoop: function (e, t, s, a) {
			if (
				(void 0 === e && (e = 0),
				void 0 === t && (t = this.params.speed),
				void 0 === s && (s = !0),
				"string" == typeof e)
			) {
				e = parseInt(e, 10);
			}
			const i = this;
			let r = e;
			return (
				i.params.loop &&
					(i.virtual && i.params.virtual.enabled
						? (r += i.virtual.slidesBefore)
						: (r = i.getSlideIndexByData(r))),
				i.slideTo(r, t, s, a)
			);
		},
		slideNext: function (e, t, s) {
			void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
			const a = this,
				{ enabled: i, params: r, animating: n } = a;
			if (!i) return a;
			let l = r.slidesPerGroup;
			"auto" === r.slidesPerView &&
				1 === r.slidesPerGroup &&
				r.slidesPerGroupAuto &&
				(l = Math.max(a.slidesPerViewDynamic("current", !0), 1));
			const o = a.activeIndex < r.slidesPerGroupSkip ? 1 : l,
				d = a.virtual && r.virtual.enabled;
			if (r.loop) {
				if (n && !d && r.loopPreventsSliding) return !1;
				a.loopFix({ direction: "next" }),
					(a._clientLeft = a.wrapperEl.clientLeft);
			}
			return r.rewind && a.isEnd
				? a.slideTo(0, e, t, s)
				: a.slideTo(a.activeIndex + o, e, t, s);
		},
		slidePrev: function (e, t, s) {
			void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
			const a = this,
				{
					params: i,
					snapGrid: r,
					slidesGrid: n,
					rtlTranslate: l,
					enabled: o,
					animating: d,
				} = a;
			if (!o) return a;
			const c = a.virtual && i.virtual.enabled;
			if (i.loop) {
				if (d && !c && i.loopPreventsSliding) return !1;
				a.loopFix({ direction: "prev" }),
					(a._clientLeft = a.wrapperEl.clientLeft);
			}
			function p(e) {
				return e < 0 ? -Math.floor(Math.abs(e)) : Math.floor(e);
			}
			const u = p(l ? a.translate : -a.translate),
				m = r.map((e) => p(e));
			let h = r[m.indexOf(u) - 1];
			if (void 0 === h && i.cssMode) {
				let e;
				r.forEach((t, s) => {
					u >= t && (e = s);
				}),
					void 0 !== e && (h = r[e > 0 ? e - 1 : e]);
			}
			let f = 0;
			if (
				(void 0 !== h &&
					((f = n.indexOf(h)),
					f < 0 && (f = a.activeIndex - 1),
					"auto" === i.slidesPerView &&
						1 === i.slidesPerGroup &&
						i.slidesPerGroupAuto &&
						((f = f - a.slidesPerViewDynamic("previous", !0) + 1),
						(f = Math.max(f, 0)))),
				i.rewind && a.isBeginning)
			) {
				const i =
					a.params.virtual && a.params.virtual.enabled && a.virtual
						? a.virtual.slides.length - 1
						: a.slides.length - 1;
				return a.slideTo(i, e, t, s);
			}
			return a.slideTo(f, e, t, s);
		},
		slideReset: function (e, t, s) {
			return (
				void 0 === e && (e = this.params.speed),
				void 0 === t && (t = !0),
				this.slideTo(this.activeIndex, e, t, s)
			);
		},
		slideToClosest: function (e, t, s, a) {
			void 0 === e && (e = this.params.speed),
				void 0 === t && (t = !0),
				void 0 === a && (a = 0.5);
			const i = this;
			let r = i.activeIndex;
			const n = Math.min(i.params.slidesPerGroupSkip, r),
				l = n + Math.floor((r - n) / i.params.slidesPerGroup),
				o = i.rtlTranslate ? i.translate : -i.translate;
			if (o >= i.snapGrid[l]) {
				const e = i.snapGrid[l];
				o - e > (i.snapGrid[l + 1] - e) * a &&
					(r += i.params.slidesPerGroup);
			} else {
				const e = i.snapGrid[l - 1];
				o - e <= (i.snapGrid[l] - e) * a &&
					(r -= i.params.slidesPerGroup);
			}
			return (
				(r = Math.max(r, 0)),
				(r = Math.min(r, i.slidesGrid.length - 1)),
				i.slideTo(r, e, t, s)
			);
		},
		slideToClickedSlide: function () {
			const e = this,
				{ params: t, slidesEl: s } = e,
				a =
					"auto" === t.slidesPerView
						? e.slidesPerViewDynamic()
						: t.slidesPerView;
			let i,
				r = e.clickedIndex;
			const l = e.isElement ? "swiper-slide" : `.${t.slideClass}`;
			if (t.loop) {
				if (e.animating) return;
				(i = parseInt(
					e.clickedSlide.getAttribute("data-swiper-slide-index"),
					10
				)),
					t.centeredSlides
						? r < e.loopedSlides - a / 2 ||
						  r > e.slides.length - e.loopedSlides + a / 2
							? (e.loopFix(),
							  (r = e.getSlideIndex(
									f(
										s,
										`${l}[data-swiper-slide-index="${i}"]`
									)[0]
							  )),
							  n(() => {
									e.slideTo(r);
							  }))
							: e.slideTo(r)
						: r > e.slides.length - a
						? (e.loopFix(),
						  (r = e.getSlideIndex(
								f(s, `${l}[data-swiper-slide-index="${i}"]`)[0]
						  )),
						  n(() => {
								e.slideTo(r);
						  }))
						: e.slideTo(r);
			} else e.slideTo(r);
		},
	};
	var H = {
		loopCreate: function (e) {
			const t = this,
				{ params: s, slidesEl: a } = t;
			if (!s.loop || (t.virtual && t.params.virtual.enabled)) return;
			f(a, `.${s.slideClass}, swiper-slide`).forEach((e, t) => {
				e.setAttribute("data-swiper-slide-index", t);
			}),
				t.loopFix({
					slideRealIndex: e,
					direction: s.centeredSlides ? void 0 : "next",
				});
		},
		loopFix: function (e) {
			let {
				slideRealIndex: t,
				slideTo: s = !0,
				direction: a,
				setTranslate: i,
				activeSlideIndex: r,
				byController: n,
				byMousewheel: l,
			} = void 0 === e ? {} : e;
			const o = this;
			if (!o.params.loop) return;
			o.emit("beforeLoopFix");
			const {
				slides: d,
				allowSlidePrev: c,
				allowSlideNext: p,
				slidesEl: u,
				params: m,
			} = o;
			if (
				((o.allowSlidePrev = !0),
				(o.allowSlideNext = !0),
				o.virtual && m.virtual.enabled)
			)
				return (
					s &&
						(m.centeredSlides || 0 !== o.snapIndex
							? m.centeredSlides && o.snapIndex < m.slidesPerView
								? o.slideTo(
										o.virtual.slides.length + o.snapIndex,
										0,
										!1,
										!0
								  )
								: o.snapIndex === o.snapGrid.length - 1 &&
								  o.slideTo(o.virtual.slidesBefore, 0, !1, !0)
							: o.slideTo(o.virtual.slides.length, 0, !1, !0)),
					(o.allowSlidePrev = c),
					(o.allowSlideNext = p),
					void o.emit("loopFix")
				);
			const h =
				"auto" === m.slidesPerView
					? o.slidesPerViewDynamic()
					: Math.ceil(parseFloat(m.slidesPerView, 10));
			let f = m.loopedSlides || h;
			f % m.slidesPerGroup != 0 &&
				(f += m.slidesPerGroup - (f % m.slidesPerGroup)),
				(o.loopedSlides = f);
			const g = [],
				v = [];
			let w = o.activeIndex;
			void 0 === r
				? (r = o.getSlideIndex(
						o.slides.filter((e) =>
							e.classList.contains(m.slideActiveClass)
						)[0]
				  ))
				: (w = r);
			const b = "next" === a || !a,
				y = "prev" === a || !a;
			let E = 0,
				x = 0;
			if (r < f) {
				E = Math.max(f - r, m.slidesPerGroup);
				for (let e = 0; e < f - r; e += 1) {
					const t = e - Math.floor(e / d.length) * d.length;
					g.push(d.length - t - 1);
				}
			} else if (r > o.slides.length - 2 * f) {
				x = Math.max(r - (o.slides.length - 2 * f), m.slidesPerGroup);
				for (let e = 0; e < x; e += 1) {
					const t = e - Math.floor(e / d.length) * d.length;
					v.push(t);
				}
			}
			if (
				(y &&
					g.forEach((e) => {
						(o.slides[e].swiperLoopMoveDOM = !0),
							u.prepend(o.slides[e]),
							(o.slides[e].swiperLoopMoveDOM = !1);
					}),
				b &&
					v.forEach((e) => {
						(o.slides[e].swiperLoopMoveDOM = !0),
							u.append(o.slides[e]),
							(o.slides[e].swiperLoopMoveDOM = !1);
					}),
				o.recalcSlides(),
				"auto" === m.slidesPerView && o.updateSlides(),
				m.watchSlidesProgress && o.updateSlidesOffset(),
				s)
			)
				if (g.length > 0 && y)
					if (void 0 === t) {
						const e = o.slidesGrid[w],
							t = o.slidesGrid[w + E] - e;
						l
							? o.setTranslate(o.translate - t)
							: (o.slideTo(w + E, 0, !1, !0),
							  i &&
									(o.touches[
										o.isHorizontal() ? "startX" : "startY"
									] += t));
					} else i && o.slideToLoop(t, 0, !1, !0);
				else if (v.length > 0 && b)
					if (void 0 === t) {
						const e = o.slidesGrid[w],
							t = o.slidesGrid[w - x] - e;
						l
							? o.setTranslate(o.translate - t)
							: (o.slideTo(w - x, 0, !1, !0),
							  i &&
									(o.touches[
										o.isHorizontal() ? "startX" : "startY"
									] += t));
					} else o.slideToLoop(t, 0, !1, !0);
			if (
				((o.allowSlidePrev = c),
				(o.allowSlideNext = p),
				o.controller && o.controller.control && !n)
			) {
				const e = {
					slideRealIndex: t,
					slideTo: !1,
					direction: a,
					setTranslate: i,
					activeSlideIndex: r,
					byController: !0,
				};
				Array.isArray(o.controller.control)
					? o.controller.control.forEach((t) => {
							!t.destroyed && t.params.loop && t.loopFix(e);
					  })
					: o.controller.control instanceof o.constructor &&
					  o.controller.control.params.loop &&
					  o.controller.control.loopFix(e);
			}
			o.emit("loopFix");
		},
		loopDestroy: function () {
			const e = this,
				{ params: t, slidesEl: s } = e;
			if (!t.loop || (e.virtual && e.params.virtual.enabled)) return;
			e.recalcSlides();
			const a = [];
			e.slides.forEach((e) => {
				const t =
					void 0 === e.swiperSlideIndex
						? 1 * e.getAttribute("data-swiper-slide-index")
						: e.swiperSlideIndex;
				a[t] = e;
			}),
				e.slides.forEach((e) => {
					e.removeAttribute("data-swiper-slide-index");
				}),
				a.forEach((e) => {
					s.append(e);
				}),
				e.recalcSlides(),
				e.slideTo(e.realIndex, 0);
		},
	};
	function X(e) {
		const t = this,
			s = a(),
			i = r(),
			n = t.touchEventsData;
		n.evCache.push(e);
		const { params: o, touches: d, enabled: c } = t;
		if (!c) return;
		if (!o.simulateTouch && "mouse" === e.pointerType) return;
		if (t.animating && o.preventInteractionOnTransition) return;
		!t.animating && o.cssMode && o.loop && t.loopFix();
		let p = e;
		p.originalEvent && (p = p.originalEvent);
		let u = p.target;
		if ("wrapper" === o.touchEventsTarget && !t.wrapperEl.contains(u))
			return;
		if ("which" in p && 3 === p.which) return;
		if ("button" in p && p.button > 0) return;
		if (n.isTouched && n.isMoved) return;
		const m = !!o.noSwipingClass && "" !== o.noSwipingClass,
			h = e.composedPath ? e.composedPath() : e.path;
		m && p.target && p.target.shadowRoot && h && (u = h[0]);
		const f = o.noSwipingSelector
				? o.noSwipingSelector
				: `.${o.noSwipingClass}`,
			g = !(!p.target || !p.target.shadowRoot);
		if (
			o.noSwiping &&
			(g
				? (function (e, t) {
						return (
							void 0 === t && (t = this),
							(function t(s) {
								if (!s || s === a() || s === r()) return null;
								s.assignedSlot && (s = s.assignedSlot);
								const i = s.closest(e);
								return i || s.getRootNode
									? i || t(s.getRootNode().host)
									: null;
							})(t)
						);
				  })(f, u)
				: u.closest(f))
		)
			return void (t.allowClick = !0);
		if (o.swipeHandler && !u.closest(o.swipeHandler)) return;
		(d.currentX = p.pageX), (d.currentY = p.pageY);
		const v = d.currentX,
			w = d.currentY,
			b = o.edgeSwipeDetection || o.iOSEdgeSwipeDetection,
			y = o.edgeSwipeThreshold || o.iOSEdgeSwipeThreshold;
		if (b && (v <= y || v >= i.innerWidth - y)) {
			if ("prevent" !== b) return;
			e.preventDefault();
		}
		Object.assign(n, {
			isTouched: !0,
			isMoved: !1,
			allowTouchCallbacks: !0,
			isScrolling: void 0,
			startMoving: void 0,
		}),
			(d.startX = v),
			(d.startY = w),
			(n.touchStartTime = l()),
			(t.allowClick = !0),
			t.updateSize(),
			(t.swipeDirection = void 0),
			o.threshold > 0 && (n.allowThresholdMove = !1);
		let E = !0;
		u.matches(n.focusableElements) &&
			((E = !1), "SELECT" === u.nodeName && (n.isTouched = !1)),
			s.activeElement &&
				s.activeElement.matches(n.focusableElements) &&
				s.activeElement !== u &&
				s.activeElement.blur();
		const x = E && t.allowTouchMove && o.touchStartPreventDefault;
		(!o.touchStartForcePreventDefault && !x) ||
			u.isContentEditable ||
			p.preventDefault(),
			o.freeMode &&
				o.freeMode.enabled &&
				t.freeMode &&
				t.animating &&
				!o.cssMode &&
				t.freeMode.onTouchStart(),
			t.emit("touchStart", p);
	}
	function Y(e) {
		const t = a(),
			s = this,
			i = s.touchEventsData,
			{ params: r, touches: n, rtlTranslate: o, enabled: d } = s;
		if (!d) return;
		if (!r.simulateTouch && "mouse" === e.pointerType) return;
		let c = e;
		if ((c.originalEvent && (c = c.originalEvent), !i.isTouched))
			return void (
				i.startMoving &&
				i.isScrolling &&
				s.emit("touchMoveOpposite", c)
			);
		const p = i.evCache.findIndex((e) => e.pointerId === c.pointerId);
		p >= 0 && (i.evCache[p] = c);
		const u = i.evCache.length > 1 ? i.evCache[0] : c,
			m = u.pageX,
			h = u.pageY;
		if (c.preventedByNestedSwiper)
			return (n.startX = m), void (n.startY = h);
		if (!s.allowTouchMove)
			return (
				c.target.matches(i.focusableElements) || (s.allowClick = !1),
				void (
					i.isTouched &&
					(Object.assign(n, {
						startX: m,
						startY: h,
						prevX: s.touches.currentX,
						prevY: s.touches.currentY,
						currentX: m,
						currentY: h,
					}),
					(i.touchStartTime = l()))
				)
			);
		if (r.touchReleaseOnEdges && !r.loop)
			if (s.isVertical()) {
				if (
					(h < n.startY && s.translate <= s.maxTranslate()) ||
					(h > n.startY && s.translate >= s.minTranslate())
				)
					return (i.isTouched = !1), void (i.isMoved = !1);
			} else if (
				(m < n.startX && s.translate <= s.maxTranslate()) ||
				(m > n.startX && s.translate >= s.minTranslate())
			)
				return;
		if (
			t.activeElement &&
			c.target === t.activeElement &&
			c.target.matches(i.focusableElements)
		)
			return (i.isMoved = !0), void (s.allowClick = !1);
		if (
			(i.allowTouchCallbacks && s.emit("touchMove", c),
			c.targetTouches && c.targetTouches.length > 1)
		)
			return;
		(n.currentX = m), (n.currentY = h);
		const f = n.currentX - n.startX,
			g = n.currentY - n.startY;
		if (
			s.params.threshold &&
			Math.sqrt(f ** 2 + g ** 2) < s.params.threshold
		)
			return;
		if (void 0 === i.isScrolling) {
			let e;
			(s.isHorizontal() && n.currentY === n.startY) ||
			(s.isVertical() && n.currentX === n.startX)
				? (i.isScrolling = !1)
				: f * f + g * g >= 25 &&
				  ((e = (180 * Math.atan2(Math.abs(g), Math.abs(f))) / Math.PI),
				  (i.isScrolling = s.isHorizontal()
						? e > r.touchAngle
						: 90 - e > r.touchAngle));
		}
		if (
			(i.isScrolling && s.emit("touchMoveOpposite", c),
			void 0 === i.startMoving &&
				((n.currentX === n.startX && n.currentY === n.startY) ||
					(i.startMoving = !0)),
			i.isScrolling ||
				(s.zoom &&
					s.params.zoom &&
					s.params.zoom.enabled &&
					i.evCache.length > 1))
		)
			return void (i.isTouched = !1);
		if (!i.startMoving) return;
		(s.allowClick = !1),
			!r.cssMode && c.cancelable && c.preventDefault(),
			r.touchMoveStopPropagation && !r.nested && c.stopPropagation();
		let v = s.isHorizontal() ? f : g,
			w = s.isHorizontal()
				? n.currentX - n.previousX
				: n.currentY - n.previousY;
		r.oneWayMovement &&
			((v = Math.abs(v) * (o ? 1 : -1)),
			(w = Math.abs(w) * (o ? 1 : -1))),
			(n.diff = v),
			(v *= r.touchRatio),
			o && ((v = -v), (w = -w));
		const b = s.touchesDirection;
		(s.swipeDirection = v > 0 ? "prev" : "next"),
			(s.touchesDirection = w > 0 ? "prev" : "next");
		const y = s.params.loop && !r.cssMode;
		if (!i.isMoved) {
			if (
				(y && s.loopFix({ direction: s.swipeDirection }),
				(i.startTranslate = s.getTranslate()),
				s.setTransition(0),
				s.animating)
			) {
				const e = new window.CustomEvent("transitionend", {
					bubbles: !0,
					cancelable: !0,
				});
				s.wrapperEl.dispatchEvent(e);
			}
			(i.allowMomentumBounce = !1),
				!r.grabCursor ||
					(!0 !== s.allowSlideNext && !0 !== s.allowSlidePrev) ||
					s.setGrabCursor(!0),
				s.emit("sliderFirstMove", c);
		}
		let E;
		i.isMoved &&
			b !== s.touchesDirection &&
			y &&
			Math.abs(v) >= 1 &&
			(s.loopFix({ direction: s.swipeDirection, setTranslate: !0 }),
			(E = !0)),
			s.emit("sliderMove", c),
			(i.isMoved = !0),
			(i.currentTranslate = v + i.startTranslate);
		let x = !0,
			S = r.resistanceRatio;
		if (
			(r.touchReleaseOnEdges && (S = 0),
			v > 0
				? (y &&
						!E &&
						i.currentTranslate >
							(r.centeredSlides
								? s.minTranslate() - s.size / 2
								: s.minTranslate()) &&
						s.loopFix({
							direction: "prev",
							setTranslate: !0,
							activeSlideIndex: 0,
						}),
				  i.currentTranslate > s.minTranslate() &&
						((x = !1),
						r.resistance &&
							(i.currentTranslate =
								s.minTranslate() -
								1 +
								(-s.minTranslate() + i.startTranslate + v) **
									S)))
				: v < 0 &&
				  (y &&
						!E &&
						i.currentTranslate <
							(r.centeredSlides
								? s.maxTranslate() + s.size / 2
								: s.maxTranslate()) &&
						s.loopFix({
							direction: "next",
							setTranslate: !0,
							activeSlideIndex:
								s.slides.length -
								("auto" === r.slidesPerView
									? s.slidesPerViewDynamic()
									: Math.ceil(
											parseFloat(r.slidesPerView, 10)
									  )),
						}),
				  i.currentTranslate < s.maxTranslate() &&
						((x = !1),
						r.resistance &&
							(i.currentTranslate =
								s.maxTranslate() +
								1 -
								(s.maxTranslate() - i.startTranslate - v) **
									S))),
			x && (c.preventedByNestedSwiper = !0),
			!s.allowSlideNext &&
				"next" === s.swipeDirection &&
				i.currentTranslate < i.startTranslate &&
				(i.currentTranslate = i.startTranslate),
			!s.allowSlidePrev &&
				"prev" === s.swipeDirection &&
				i.currentTranslate > i.startTranslate &&
				(i.currentTranslate = i.startTranslate),
			s.allowSlidePrev ||
				s.allowSlideNext ||
				(i.currentTranslate = i.startTranslate),
			r.threshold > 0)
		) {
			if (!(Math.abs(v) > r.threshold || i.allowThresholdMove))
				return void (i.currentTranslate = i.startTranslate);
			if (!i.allowThresholdMove)
				return (
					(i.allowThresholdMove = !0),
					(n.startX = n.currentX),
					(n.startY = n.currentY),
					(i.currentTranslate = i.startTranslate),
					void (n.diff = s.isHorizontal()
						? n.currentX - n.startX
						: n.currentY - n.startY)
				);
		}
		r.followFinger &&
			!r.cssMode &&
			(((r.freeMode && r.freeMode.enabled && s.freeMode) ||
				r.watchSlidesProgress) &&
				(s.updateActiveIndex(), s.updateSlidesClasses()),
			r.freeMode &&
				r.freeMode.enabled &&
				s.freeMode &&
				s.freeMode.onTouchMove(),
			s.updateProgress(i.currentTranslate),
			s.setTranslate(i.currentTranslate));
	}
	function B(e) {
		const t = this,
			s = t.touchEventsData,
			a = s.evCache.findIndex((t) => t.pointerId === e.pointerId);
		if (
			(a >= 0 && s.evCache.splice(a, 1),
			["pointercancel", "pointerout", "pointerleave"].includes(e.type))
		) {
			if (
				!(
					"pointercancel" === e.type &&
					(t.browser.isSafari || t.browser.isWebView)
				)
			)
				return;
		}
		const {
			params: i,
			touches: r,
			rtlTranslate: o,
			slidesGrid: d,
			enabled: c,
		} = t;
		if (!c) return;
		if (!i.simulateTouch && "mouse" === e.pointerType) return;
		let p = e;
		if (
			(p.originalEvent && (p = p.originalEvent),
			s.allowTouchCallbacks && t.emit("touchEnd", p),
			(s.allowTouchCallbacks = !1),
			!s.isTouched)
		)
			return (
				s.isMoved && i.grabCursor && t.setGrabCursor(!1),
				(s.isMoved = !1),
				void (s.startMoving = !1)
			);
		i.grabCursor &&
			s.isMoved &&
			s.isTouched &&
			(!0 === t.allowSlideNext || !0 === t.allowSlidePrev) &&
			t.setGrabCursor(!1);
		const u = l(),
			m = u - s.touchStartTime;
		if (t.allowClick) {
			const e = p.path || (p.composedPath && p.composedPath());
			t.updateClickedSlide((e && e[0]) || p.target),
				t.emit("tap click", p),
				m < 300 &&
					u - s.lastClickTime < 300 &&
					t.emit("doubleTap doubleClick", p);
		}
		if (
			((s.lastClickTime = l()),
			n(() => {
				t.destroyed || (t.allowClick = !0);
			}),
			!s.isTouched ||
				!s.isMoved ||
				!t.swipeDirection ||
				0 === r.diff ||
				s.currentTranslate === s.startTranslate)
		)
			return (
				(s.isTouched = !1), (s.isMoved = !1), void (s.startMoving = !1)
			);
		let h;
		if (
			((s.isTouched = !1),
			(s.isMoved = !1),
			(s.startMoving = !1),
			(h = i.followFinger
				? o
					? t.translate
					: -t.translate
				: -s.currentTranslate),
			i.cssMode)
		)
			return;
		if (i.freeMode && i.freeMode.enabled)
			return void t.freeMode.onTouchEnd({ currentPos: h });
		let f = 0,
			g = t.slidesSizesGrid[0];
		for (
			let e = 0;
			e < d.length;
			e += e < i.slidesPerGroupSkip ? 1 : i.slidesPerGroup
		) {
			const t = e < i.slidesPerGroupSkip - 1 ? 1 : i.slidesPerGroup;
			void 0 !== d[e + t]
				? h >= d[e] && h < d[e + t] && ((f = e), (g = d[e + t] - d[e]))
				: h >= d[e] &&
				  ((f = e), (g = d[d.length - 1] - d[d.length - 2]));
		}
		let v = null,
			w = null;
		i.rewind &&
			(t.isBeginning
				? (w =
						i.virtual && i.virtual.enabled && t.virtual
							? t.virtual.slides.length - 1
							: t.slides.length - 1)
				: t.isEnd && (v = 0));
		const b = (h - d[f]) / g,
			y = f < i.slidesPerGroupSkip - 1 ? 1 : i.slidesPerGroup;
		if (m > i.longSwipesMs) {
			if (!i.longSwipes) return void t.slideTo(t.activeIndex);
			"next" === t.swipeDirection &&
				(b >= i.longSwipesRatio
					? t.slideTo(i.rewind && t.isEnd ? v : f + y)
					: t.slideTo(f)),
				"prev" === t.swipeDirection &&
					(b > 1 - i.longSwipesRatio
						? t.slideTo(f + y)
						: null !== w && b < 0 && Math.abs(b) > i.longSwipesRatio
						? t.slideTo(w)
						: t.slideTo(f));
		} else {
			if (!i.shortSwipes) return void t.slideTo(t.activeIndex);
			t.navigation &&
			(p.target === t.navigation.nextEl ||
				p.target === t.navigation.prevEl)
				? p.target === t.navigation.nextEl
					? t.slideTo(f + y)
					: t.slideTo(f)
				: ("next" === t.swipeDirection &&
						t.slideTo(null !== v ? v : f + y),
				  "prev" === t.swipeDirection && t.slideTo(null !== w ? w : f));
		}
	}
	function N() {
		const e = this,
			{ params: t, el: s } = e;
		if (s && 0 === s.offsetWidth) return;
		t.breakpoints && e.setBreakpoint();
		const { allowSlideNext: a, allowSlidePrev: i, snapGrid: r } = e,
			n = e.virtual && e.params.virtual.enabled;
		(e.allowSlideNext = !0),
			(e.allowSlidePrev = !0),
			e.updateSize(),
			e.updateSlides(),
			e.updateSlidesClasses();
		const l = n && t.loop;
		!("auto" === t.slidesPerView || t.slidesPerView > 1) ||
		!e.isEnd ||
		e.isBeginning ||
		e.params.centeredSlides ||
		l
			? e.params.loop && !n
				? e.slideToLoop(e.realIndex, 0, !1, !0)
				: e.slideTo(e.activeIndex, 0, !1, !0)
			: e.slideTo(e.slides.length - 1, 0, !1, !0),
			e.autoplay &&
				e.autoplay.running &&
				e.autoplay.paused &&
				(clearTimeout(e.autoplay.resizeTimeout),
				(e.autoplay.resizeTimeout = setTimeout(() => {
					e.autoplay &&
						e.autoplay.running &&
						e.autoplay.paused &&
						e.autoplay.resume();
				}, 500))),
			(e.allowSlidePrev = i),
			(e.allowSlideNext = a),
			e.params.watchOverflow && r !== e.snapGrid && e.checkOverflow();
	}
	function q(e) {
		const t = this;
		t.enabled &&
			(t.allowClick ||
				(t.params.preventClicks && e.preventDefault(),
				t.params.preventClicksPropagation &&
					t.animating &&
					(e.stopPropagation(), e.stopImmediatePropagation())));
	}
	function R() {
		const e = this,
			{ wrapperEl: t, rtlTranslate: s, enabled: a } = e;
		if (!a) return;
		let i;
		(e.previousTranslate = e.translate),
			e.isHorizontal()
				? (e.translate = -t.scrollLeft)
				: (e.translate = -t.scrollTop),
			0 === e.translate && (e.translate = 0),
			e.updateActiveIndex(),
			e.updateSlidesClasses();
		const r = e.maxTranslate() - e.minTranslate();
		(i = 0 === r ? 0 : (e.translate - e.minTranslate()) / r),
			i !== e.progress &&
				e.updateProgress(s ? -e.translate : e.translate),
			e.emit("setTranslate", e.translate, !1);
	}
	function F(e) {
		const t = this;
		A(t, e.target),
			t.params.cssMode ||
				("auto" !== t.params.slidesPerView && !t.params.autoHeight) ||
				t.update();
	}
	let _ = !1;
	function V() {}
	const j = (e, t) => {
		const s = a(),
			{ params: i, el: r, wrapperEl: n, device: l } = e,
			o = !!i.nested,
			d = "on" === t ? "addEventListener" : "removeEventListener",
			c = t;
		r[d]("pointerdown", e.onTouchStart, { passive: !1 }),
			s[d]("pointermove", e.onTouchMove, { passive: !1, capture: o }),
			s[d]("pointerup", e.onTouchEnd, { passive: !0 }),
			s[d]("pointercancel", e.onTouchEnd, { passive: !0 }),
			s[d]("pointerout", e.onTouchEnd, { passive: !0 }),
			s[d]("pointerleave", e.onTouchEnd, { passive: !0 }),
			(i.preventClicks || i.preventClicksPropagation) &&
				r[d]("click", e.onClick, !0),
			i.cssMode && n[d]("scroll", e.onScroll),
			i.updateOnWindowResize
				? e[c](
						l.ios || l.android
							? "resize orientationchange observerUpdate"
							: "resize observerUpdate",
						N,
						!0
				  )
				: e[c]("observerUpdate", N, !0),
			r[d]("load", e.onLoad, { capture: !0 });
	};
	const W = (e, t) => e.grid && t.grid && t.grid.rows > 1;
	var U = {
		init: !0,
		direction: "horizontal",
		oneWayMovement: !1,
		touchEventsTarget: "wrapper",
		initialSlide: 0,
		speed: 300,
		cssMode: !1,
		updateOnWindowResize: !0,
		resizeObserver: !0,
		nested: !1,
		createElements: !1,
		enabled: !0,
		focusableElements:
			"input, select, option, textarea, button, video, label",
		width: null,
		height: null,
		preventInteractionOnTransition: !1,
		userAgent: null,
		url: null,
		edgeSwipeDetection: !1,
		edgeSwipeThreshold: 20,
		autoHeight: !1,
		setWrapperSize: !1,
		virtualTranslate: !1,
		effect: "slide",
		breakpoints: void 0,
		breakpointsBase: "window",
		spaceBetween: 0,
		slidesPerView: 1,
		slidesPerGroup: 1,
		slidesPerGroupSkip: 0,
		slidesPerGroupAuto: !1,
		centeredSlides: !1,
		centeredSlidesBounds: !1,
		slidesOffsetBefore: 0,
		slidesOffsetAfter: 0,
		normalizeSlideIndex: !0,
		centerInsufficientSlides: !1,
		watchOverflow: !0,
		roundLengths: !1,
		touchRatio: 1,
		touchAngle: 45,
		simulateTouch: !0,
		shortSwipes: !0,
		longSwipes: !0,
		longSwipesRatio: 0.5,
		longSwipesMs: 300,
		followFinger: !0,
		allowTouchMove: !0,
		threshold: 5,
		touchMoveStopPropagation: !1,
		touchStartPreventDefault: !0,
		touchStartForcePreventDefault: !1,
		touchReleaseOnEdges: !1,
		uniqueNavElements: !0,
		resistance: !0,
		resistanceRatio: 0.85,
		watchSlidesProgress: !1,
		grabCursor: !1,
		preventClicks: !0,
		preventClicksPropagation: !0,
		slideToClickedSlide: !1,
		loop: !1,
		loopedSlides: null,
		loopPreventsSliding: !0,
		rewind: !1,
		allowSlidePrev: !0,
		allowSlideNext: !0,
		swipeHandler: null,
		noSwiping: !0,
		noSwipingClass: "swiper-no-swiping",
		noSwipingSelector: null,
		passiveListeners: !0,
		maxBackfaceHiddenSlides: 10,
		containerModifierClass: "swiper-",
		slideClass: "swiper-slide",
		slideActiveClass: "swiper-slide-active",
		slideVisibleClass: "swiper-slide-visible",
		slideNextClass: "swiper-slide-next",
		slidePrevClass: "swiper-slide-prev",
		wrapperClass: "swiper-wrapper",
		lazyPreloaderClass: "swiper-lazy-preloader",
		lazyPreloadPrevNext: 0,
		runCallbacksOnInit: !0,
		_emitClasses: !1,
	};
	function K(e, t) {
		return function (s) {
			void 0 === s && (s = {});
			const a = Object.keys(s)[0],
				i = s[a];
			"object" == typeof i && null !== i
				? (["navigation", "pagination", "scrollbar"].indexOf(a) >= 0 &&
						!0 === e[a] &&
						(e[a] = { auto: !0 }),
				  a in e && "enabled" in i
						? (!0 === e[a] && (e[a] = { enabled: !0 }),
						  "object" != typeof e[a] ||
								"enabled" in e[a] ||
								(e[a].enabled = !0),
						  e[a] || (e[a] = { enabled: !1 }),
						  p(t, s))
						: p(t, s))
				: p(t, s);
		};
	}
	const Z = {
			eventsEmitter: z,
			update: k,
			translate: O,
			transition: {
				setTransition: function (e, t) {
					const s = this;
					s.params.cssMode ||
						(s.wrapperEl.style.transitionDuration = `${e}ms`),
						s.emit("setTransition", e, t);
				},
				transitionStart: function (e, t) {
					void 0 === e && (e = !0);
					const s = this,
						{ params: a } = s;
					a.cssMode ||
						(a.autoHeight && s.updateAutoHeight(),
						D({
							swiper: s,
							runCallbacks: e,
							direction: t,
							step: "Start",
						}));
				},
				transitionEnd: function (e, t) {
					void 0 === e && (e = !0);
					const s = this,
						{ params: a } = s;
					(s.animating = !1),
						a.cssMode ||
							(s.setTransition(0),
							D({
								swiper: s,
								runCallbacks: e,
								direction: t,
								step: "End",
							}));
				},
			},
			slide: G,
			loop: H,
			grabCursor: {
				setGrabCursor: function (e) {
					const t = this;
					if (
						!t.params.simulateTouch ||
						(t.params.watchOverflow && t.isLocked) ||
						t.params.cssMode
					)
						return;
					const s =
						"container" === t.params.touchEventsTarget
							? t.el
							: t.wrapperEl;
					t.isElement && (t.__preventObserver__ = !0),
						(s.style.cursor = "move"),
						(s.style.cursor = e ? "grabbing" : "grab"),
						t.isElement &&
							requestAnimationFrame(() => {
								t.__preventObserver__ = !1;
							});
				},
				unsetGrabCursor: function () {
					const e = this;
					(e.params.watchOverflow && e.isLocked) ||
						e.params.cssMode ||
						(e.isElement && (e.__preventObserver__ = !0),
						(e[
							"container" === e.params.touchEventsTarget
								? "el"
								: "wrapperEl"
						].style.cursor = ""),
						e.isElement &&
							requestAnimationFrame(() => {
								e.__preventObserver__ = !1;
							}));
				},
			},
			events: {
				attachEvents: function () {
					const e = this,
						t = a(),
						{ params: s } = e;
					(e.onTouchStart = X.bind(e)),
						(e.onTouchMove = Y.bind(e)),
						(e.onTouchEnd = B.bind(e)),
						s.cssMode && (e.onScroll = R.bind(e)),
						(e.onClick = q.bind(e)),
						(e.onLoad = F.bind(e)),
						_ || (t.addEventListener("touchstart", V), (_ = !0)),
						j(e, "on");
				},
				detachEvents: function () {
					j(this, "off");
				},
			},
			breakpoints: {
				setBreakpoint: function () {
					const e = this,
						{ realIndex: t, initialized: s, params: a, el: i } = e,
						r = a.breakpoints;
					if (!r || (r && 0 === Object.keys(r).length)) return;
					const n = e.getBreakpoint(
						r,
						e.params.breakpointsBase,
						e.el
					);
					if (!n || e.currentBreakpoint === n) return;
					const l = (n in r ? r[n] : void 0) || e.originalParams,
						o = W(e, a),
						d = W(e, l),
						c = a.enabled;
					o && !d
						? (i.classList.remove(
								`${a.containerModifierClass}grid`,
								`${a.containerModifierClass}grid-column`
						  ),
						  e.emitContainerClasses())
						: !o &&
						  d &&
						  (i.classList.add(`${a.containerModifierClass}grid`),
						  ((l.grid.fill && "column" === l.grid.fill) ||
								(!l.grid.fill && "column" === a.grid.fill)) &&
								i.classList.add(
									`${a.containerModifierClass}grid-column`
								),
						  e.emitContainerClasses()),
						["navigation", "pagination", "scrollbar"].forEach(
							(t) => {
								if (void 0 === l[t]) return;
								const s = a[t] && a[t].enabled,
									i = l[t] && l[t].enabled;
								s && !i && e[t].disable(),
									!s && i && e[t].enable();
							}
						);
					const u = l.direction && l.direction !== a.direction,
						m =
							a.loop &&
							(l.slidesPerView !== a.slidesPerView || u);
					u && s && e.changeDirection(), p(e.params, l);
					const h = e.params.enabled;
					Object.assign(e, {
						allowTouchMove: e.params.allowTouchMove,
						allowSlideNext: e.params.allowSlideNext,
						allowSlidePrev: e.params.allowSlidePrev,
					}),
						c && !h ? e.disable() : !c && h && e.enable(),
						(e.currentBreakpoint = n),
						e.emit("_beforeBreakpoint", l),
						m &&
							s &&
							(e.loopDestroy(),
							e.loopCreate(t),
							e.updateSlides()),
						e.emit("breakpoint", l);
				},
				getBreakpoint: function (e, t, s) {
					if (
						(void 0 === t && (t = "window"),
						!e || ("container" === t && !s))
					)
						return;
					let a = !1;
					const i = r(),
						n = "window" === t ? i.innerHeight : s.clientHeight,
						l = Object.keys(e).map((e) => {
							if ("string" == typeof e && 0 === e.indexOf("@")) {
								const t = parseFloat(e.substr(1));
								return { value: n * t, point: e };
							}
							return { value: e, point: e };
						});
					l.sort(
						(e, t) => parseInt(e.value, 10) - parseInt(t.value, 10)
					);
					for (let e = 0; e < l.length; e += 1) {
						const { point: r, value: n } = l[e];
						"window" === t
							? i.matchMedia(`(min-width: ${n}px)`).matches &&
							  (a = r)
							: n <= s.clientWidth && (a = r);
					}
					return a || "max";
				},
			},
			checkOverflow: {
				checkOverflow: function () {
					const e = this,
						{ isLocked: t, params: s } = e,
						{ slidesOffsetBefore: a } = s;
					if (a) {
						const t = e.slides.length - 1,
							s = e.slidesGrid[t] + e.slidesSizesGrid[t] + 2 * a;
						e.isLocked = e.size > s;
					} else e.isLocked = 1 === e.snapGrid.length;
					!0 === s.allowSlideNext && (e.allowSlideNext = !e.isLocked),
						!0 === s.allowSlidePrev &&
							(e.allowSlidePrev = !e.isLocked),
						t && t !== e.isLocked && (e.isEnd = !1),
						t !== e.isLocked &&
							e.emit(e.isLocked ? "lock" : "unlock");
				},
			},
			classes: {
				addClasses: function () {
					const e = this,
						{
							classNames: t,
							params: s,
							rtl: a,
							el: i,
							device: r,
						} = e,
						n = (function (e, t) {
							const s = [];
							return (
								e.forEach((e) => {
									"object" == typeof e
										? Object.keys(e).forEach((a) => {
												e[a] && s.push(t + a);
										  })
										: "string" == typeof e && s.push(t + e);
								}),
								s
							);
						})(
							[
								"initialized",
								s.direction,
								{
									"free-mode":
										e.params.freeMode && s.freeMode.enabled,
								},
								{ autoheight: s.autoHeight },
								{ rtl: a },
								{ grid: s.grid && s.grid.rows > 1 },
								{
									"grid-column":
										s.grid &&
										s.grid.rows > 1 &&
										"column" === s.grid.fill,
								},
								{ android: r.android },
								{ ios: r.ios },
								{ "css-mode": s.cssMode },
								{ centered: s.cssMode && s.centeredSlides },
								{ "watch-progress": s.watchSlidesProgress },
							],
							s.containerModifierClass
						);
					t.push(...n),
						i.classList.add(...t),
						e.emitContainerClasses();
				},
				removeClasses: function () {
					const { el: e, classNames: t } = this;
					e.classList.remove(...t), this.emitContainerClasses();
				},
			},
		},
		Q = {};
	class J {
		constructor() {
			let e, t;
			for (var s = arguments.length, i = new Array(s), r = 0; r < s; r++)
				i[r] = arguments[r];
			1 === i.length &&
			i[0].constructor &&
			"Object" === Object.prototype.toString.call(i[0]).slice(8, -1)
				? (t = i[0])
				: ([e, t] = i),
				t || (t = {}),
				(t = p({}, t)),
				e && !t.el && (t.el = e);
			const n = a();
			if (
				t.el &&
				"string" == typeof t.el &&
				n.querySelectorAll(t.el).length > 1
			) {
				const e = [];
				return (
					n.querySelectorAll(t.el).forEach((s) => {
						const a = p({}, t, { el: s });
						e.push(new J(a));
					}),
					e
				);
			}
			const l = this;
			(l.__swiper__ = !0),
				(l.support = C()),
				(l.device = P({ userAgent: t.userAgent })),
				(l.browser = L()),
				(l.eventsListeners = {}),
				(l.eventsAnyListeners = []),
				(l.modules = [...l.__modules__]),
				t.modules &&
					Array.isArray(t.modules) &&
					l.modules.push(...t.modules);
			const o = {};
			l.modules.forEach((e) => {
				e({
					params: t,
					swiper: l,
					extendParams: K(t, o),
					on: l.on.bind(l),
					once: l.once.bind(l),
					off: l.off.bind(l),
					emit: l.emit.bind(l),
				});
			});
			const d = p({}, U, o);
			return (
				(l.params = p({}, d, Q, t)),
				(l.originalParams = p({}, l.params)),
				(l.passedParams = p({}, t)),
				l.params &&
					l.params.on &&
					Object.keys(l.params.on).forEach((e) => {
						l.on(e, l.params.on[e]);
					}),
				l.params && l.params.onAny && l.onAny(l.params.onAny),
				Object.assign(l, {
					enabled: l.params.enabled,
					el: e,
					classNames: [],
					slides: [],
					slidesGrid: [],
					snapGrid: [],
					slidesSizesGrid: [],
					isHorizontal: () => "horizontal" === l.params.direction,
					isVertical: () => "vertical" === l.params.direction,
					activeIndex: 0,
					realIndex: 0,
					isBeginning: !0,
					isEnd: !1,
					translate: 0,
					previousTranslate: 0,
					progress: 0,
					velocity: 0,
					animating: !1,
					cssOverflowAdjustment() {
						return Math.trunc(this.translate / 2 ** 23) * 2 ** 23;
					},
					allowSlideNext: l.params.allowSlideNext,
					allowSlidePrev: l.params.allowSlidePrev,
					touchEventsData: {
						isTouched: void 0,
						isMoved: void 0,
						allowTouchCallbacks: void 0,
						touchStartTime: void 0,
						isScrolling: void 0,
						currentTranslate: void 0,
						startTranslate: void 0,
						allowThresholdMove: void 0,
						focusableElements: l.params.focusableElements,
						lastClickTime: 0,
						clickTimeout: void 0,
						velocities: [],
						allowMomentumBounce: void 0,
						startMoving: void 0,
						evCache: [],
					},
					allowClick: !0,
					allowTouchMove: l.params.allowTouchMove,
					touches: {
						startX: 0,
						startY: 0,
						currentX: 0,
						currentY: 0,
						diff: 0,
					},
					imagesToLoad: [],
					imagesLoaded: 0,
				}),
				l.emit("_swiper"),
				l.params.init && l.init(),
				l
			);
		}
		getSlideIndex(e) {
			const { slidesEl: t, params: s } = this,
				a = b(f(t, `.${s.slideClass}, swiper-slide`)[0]);
			return b(e) - a;
		}
		getSlideIndexByData(e) {
			return this.getSlideIndex(
				this.slides.filter(
					(t) => 1 * t.getAttribute("data-swiper-slide-index") === e
				)[0]
			);
		}
		recalcSlides() {
			const { slidesEl: e, params: t } = this;
			this.slides = f(e, `.${t.slideClass}, swiper-slide`);
		}
		enable() {
			const e = this;
			e.enabled ||
				((e.enabled = !0),
				e.params.grabCursor && e.setGrabCursor(),
				e.emit("enable"));
		}
		disable() {
			const e = this;
			e.enabled &&
				((e.enabled = !1),
				e.params.grabCursor && e.unsetGrabCursor(),
				e.emit("disable"));
		}
		setProgress(e, t) {
			const s = this;
			e = Math.min(Math.max(e, 0), 1);
			const a = s.minTranslate(),
				i = (s.maxTranslate() - a) * e + a;
			s.translateTo(i, void 0 === t ? 0 : t),
				s.updateActiveIndex(),
				s.updateSlidesClasses();
		}
		emitContainerClasses() {
			const e = this;
			if (!e.params._emitClasses || !e.el) return;
			const t = e.el.className
				.split(" ")
				.filter(
					(t) =>
						0 === t.indexOf("swiper") ||
						0 === t.indexOf(e.params.containerModifierClass)
				);
			e.emit("_containerClasses", t.join(" "));
		}
		getSlideClasses(e) {
			const t = this;
			return t.destroyed
				? ""
				: e.className
						.split(" ")
						.filter(
							(e) =>
								0 === e.indexOf("swiper-slide") ||
								0 === e.indexOf(t.params.slideClass)
						)
						.join(" ");
		}
		emitSlidesClasses() {
			const e = this;
			if (!e.params._emitClasses || !e.el) return;
			const t = [];
			e.slides.forEach((s) => {
				const a = e.getSlideClasses(s);
				t.push({ slideEl: s, classNames: a }),
					e.emit("_slideClass", s, a);
			}),
				e.emit("_slideClasses", t);
		}
		slidesPerViewDynamic(e, t) {
			void 0 === e && (e = "current"), void 0 === t && (t = !1);
			const {
				params: s,
				slides: a,
				slidesGrid: i,
				slidesSizesGrid: r,
				size: n,
				activeIndex: l,
			} = this;
			let o = 1;
			if (s.centeredSlides) {
				let e,
					t = a[l] ? a[l].swiperSlideSize : 0;
				for (let s = l + 1; s < a.length; s += 1)
					a[s] &&
						!e &&
						((t += a[s].swiperSlideSize),
						(o += 1),
						t > n && (e = !0));
				for (let s = l - 1; s >= 0; s -= 1)
					a[s] &&
						!e &&
						((t += a[s].swiperSlideSize),
						(o += 1),
						t > n && (e = !0));
			} else if ("current" === e)
				for (let e = l + 1; e < a.length; e += 1) {
					(t ? i[e] + r[e] - i[l] < n : i[e] - i[l] < n) && (o += 1);
				}
			else
				for (let e = l - 1; e >= 0; e -= 1) {
					i[l] - i[e] < n && (o += 1);
				}
			return o;
		}
		update() {
			const e = this;
			if (!e || e.destroyed) return;
			const { snapGrid: t, params: s } = e;
			function a() {
				const t = e.rtlTranslate ? -1 * e.translate : e.translate,
					s = Math.min(
						Math.max(t, e.maxTranslate()),
						e.minTranslate()
					);
				e.setTranslate(s),
					e.updateActiveIndex(),
					e.updateSlidesClasses();
			}
			let i;
			if (
				(s.breakpoints && e.setBreakpoint(),
				[...e.el.querySelectorAll('[loading="lazy"]')].forEach((t) => {
					t.complete && A(e, t);
				}),
				e.updateSize(),
				e.updateSlides(),
				e.updateProgress(),
				e.updateSlidesClasses(),
				s.freeMode && s.freeMode.enabled && !s.cssMode)
			)
				a(), s.autoHeight && e.updateAutoHeight();
			else {
				if (
					("auto" === s.slidesPerView || s.slidesPerView > 1) &&
					e.isEnd &&
					!s.centeredSlides
				) {
					const t =
						e.virtual && s.virtual.enabled
							? e.virtual.slides
							: e.slides;
					i = e.slideTo(t.length - 1, 0, !1, !0);
				} else i = e.slideTo(e.activeIndex, 0, !1, !0);
				i || a();
			}
			s.watchOverflow && t !== e.snapGrid && e.checkOverflow(),
				e.emit("update");
		}
		changeDirection(e, t) {
			void 0 === t && (t = !0);
			const s = this,
				a = s.params.direction;
			return (
				e || (e = "horizontal" === a ? "vertical" : "horizontal"),
				e === a ||
					("horizontal" !== e && "vertical" !== e) ||
					(s.el.classList.remove(
						`${s.params.containerModifierClass}${a}`
					),
					s.el.classList.add(
						`${s.params.containerModifierClass}${e}`
					),
					s.emitContainerClasses(),
					(s.params.direction = e),
					s.slides.forEach((t) => {
						"vertical" === e
							? (t.style.width = "")
							: (t.style.height = "");
					}),
					s.emit("changeDirection"),
					t && s.update()),
				s
			);
		}
		changeLanguageDirection(e) {
			const t = this;
			(t.rtl && "rtl" === e) ||
				(!t.rtl && "ltr" === e) ||
				((t.rtl = "rtl" === e),
				(t.rtlTranslate = "horizontal" === t.params.direction && t.rtl),
				t.rtl
					? (t.el.classList.add(
							`${t.params.containerModifierClass}rtl`
					  ),
					  (t.el.dir = "rtl"))
					: (t.el.classList.remove(
							`${t.params.containerModifierClass}rtl`
					  ),
					  (t.el.dir = "ltr")),
				t.update());
		}
		mount(e) {
			const t = this;
			if (t.mounted) return !0;
			let s = e || t.params.el;
			if (("string" == typeof s && (s = document.querySelector(s)), !s))
				return !1;
			(s.swiper = t), s.shadowEl && (t.isElement = !0);
			const a = () =>
				`.${(t.params.wrapperClass || "").trim().split(" ").join(".")}`;
			let i = (() => {
				if (s && s.shadowRoot && s.shadowRoot.querySelector) {
					return s.shadowRoot.querySelector(a());
				}
				return f(s, a())[0];
			})();
			return (
				!i &&
					t.params.createElements &&
					((i = g("div", t.params.wrapperClass)),
					s.append(i),
					f(s, `.${t.params.slideClass}`).forEach((e) => {
						i.append(e);
					})),
				Object.assign(t, {
					el: s,
					wrapperEl: i,
					slidesEl: t.isElement ? s : i,
					mounted: !0,
					rtl:
						"rtl" === s.dir.toLowerCase() ||
						"rtl" === w(s, "direction"),
					rtlTranslate:
						"horizontal" === t.params.direction &&
						("rtl" === s.dir.toLowerCase() ||
							"rtl" === w(s, "direction")),
					wrongRTL: "-webkit-box" === w(i, "display"),
				}),
				!0
			);
		}
		init(e) {
			const t = this;
			if (t.initialized) return t;
			return (
				!1 === t.mount(e) ||
					(t.emit("beforeInit"),
					t.params.breakpoints && t.setBreakpoint(),
					t.addClasses(),
					t.updateSize(),
					t.updateSlides(),
					t.params.watchOverflow && t.checkOverflow(),
					t.params.grabCursor && t.enabled && t.setGrabCursor(),
					t.params.loop && t.virtual && t.params.virtual.enabled
						? t.slideTo(
								t.params.initialSlide + t.virtual.slidesBefore,
								0,
								t.params.runCallbacksOnInit,
								!1,
								!0
						  )
						: t.slideTo(
								t.params.initialSlide,
								0,
								t.params.runCallbacksOnInit,
								!1,
								!0
						  ),
					t.params.loop && t.loopCreate(),
					t.attachEvents(),
					[...t.el.querySelectorAll('[loading="lazy"]')].forEach(
						(e) => {
							e.complete
								? A(t, e)
								: e.addEventListener("load", (e) => {
										A(t, e.target);
								  });
						}
					),
					I(t),
					(t.initialized = !0),
					I(t),
					t.emit("init"),
					t.emit("afterInit")),
				t
			);
		}
		destroy(e, t) {
			void 0 === e && (e = !0), void 0 === t && (t = !0);
			const s = this,
				{ params: a, el: i, wrapperEl: r, slides: n } = s;
			return (
				void 0 === s.params ||
					s.destroyed ||
					(s.emit("beforeDestroy"),
					(s.initialized = !1),
					s.detachEvents(),
					a.loop && s.loopDestroy(),
					t &&
						(s.removeClasses(),
						i.removeAttribute("style"),
						r.removeAttribute("style"),
						n &&
							n.length &&
							n.forEach((e) => {
								e.classList.remove(
									a.slideVisibleClass,
									a.slideActiveClass,
									a.slideNextClass,
									a.slidePrevClass
								),
									e.removeAttribute("style"),
									e.removeAttribute(
										"data-swiper-slide-index"
									);
							})),
					s.emit("destroy"),
					Object.keys(s.eventsListeners).forEach((e) => {
						s.off(e);
					}),
					!1 !== e &&
						((s.el.swiper = null),
						(function (e) {
							const t = e;
							Object.keys(t).forEach((e) => {
								try {
									t[e] = null;
								} catch (e) {}
								try {
									delete t[e];
								} catch (e) {}
							});
						})(s)),
					(s.destroyed = !0)),
				null
			);
		}
		static extendDefaults(e) {
			p(Q, e);
		}
		static get extendedDefaults() {
			return Q;
		}
		static get defaults() {
			return U;
		}
		static installModule(e) {
			J.prototype.__modules__ || (J.prototype.__modules__ = []);
			const t = J.prototype.__modules__;
			"function" == typeof e && t.indexOf(e) < 0 && t.push(e);
		}
		static use(e) {
			return Array.isArray(e)
				? (e.forEach((e) => J.installModule(e)), J)
				: (J.installModule(e), J);
		}
	}
	function ee(e, t, s, a) {
		return (
			e.params.createElements &&
				Object.keys(a).forEach((i) => {
					if (!s[i] && !0 === s.auto) {
						let r = f(e.el, `.${a[i]}`)[0];
						r ||
							((r = g("div", a[i])),
							(r.className = a[i]),
							e.el.append(r)),
							(s[i] = r),
							(t[i] = r);
					}
				}),
			s
		);
	}
	function te(e) {
		return (
			void 0 === e && (e = ""),
			`.${e
				.trim()
				.replace(/([\.:!+\/])/g, "\\$1")
				.replace(/ /g, ".")}`
		);
	}
	function se(e) {
		const t = this,
			{ params: s, slidesEl: a } = t;
		s.loop && t.loopDestroy();
		const i = (e) => {
			if ("string" == typeof e) {
				const t = document.createElement("div");
				(t.innerHTML = e), a.append(t.children[0]), (t.innerHTML = "");
			} else a.append(e);
		};
		if ("object" == typeof e && "length" in e)
			for (let t = 0; t < e.length; t += 1) e[t] && i(e[t]);
		else i(e);
		t.recalcSlides(),
			s.loop && t.loopCreate(),
			(s.observer && !t.isElement) || t.update();
	}
	function ae(e) {
		const t = this,
			{ params: s, activeIndex: a, slidesEl: i } = t;
		s.loop && t.loopDestroy();
		let r = a + 1;
		const n = (e) => {
			if ("string" == typeof e) {
				const t = document.createElement("div");
				(t.innerHTML = e), i.prepend(t.children[0]), (t.innerHTML = "");
			} else i.prepend(e);
		};
		if ("object" == typeof e && "length" in e) {
			for (let t = 0; t < e.length; t += 1) e[t] && n(e[t]);
			r = a + e.length;
		} else n(e);
		t.recalcSlides(),
			s.loop && t.loopCreate(),
			(s.observer && !t.isElement) || t.update(),
			t.slideTo(r, 0, !1);
	}
	function ie(e, t) {
		const s = this,
			{ params: a, activeIndex: i, slidesEl: r } = s;
		let n = i;
		a.loop && ((n -= s.loopedSlides), s.loopDestroy(), s.recalcSlides());
		const l = s.slides.length;
		if (e <= 0) return void s.prependSlide(t);
		if (e >= l) return void s.appendSlide(t);
		let o = n > e ? n + 1 : n;
		const d = [];
		for (let t = l - 1; t >= e; t -= 1) {
			const e = s.slides[t];
			e.remove(), d.unshift(e);
		}
		if ("object" == typeof t && "length" in t) {
			for (let e = 0; e < t.length; e += 1) t[e] && r.append(t[e]);
			o = n > e ? n + t.length : n;
		} else r.append(t);
		for (let e = 0; e < d.length; e += 1) r.append(d[e]);
		s.recalcSlides(),
			a.loop && s.loopCreate(),
			(a.observer && !s.isElement) || s.update(),
			a.loop ? s.slideTo(o + s.loopedSlides, 0, !1) : s.slideTo(o, 0, !1);
	}
	function re(e) {
		const t = this,
			{ params: s, activeIndex: a } = t;
		let i = a;
		s.loop && ((i -= t.loopedSlides), t.loopDestroy());
		let r,
			n = i;
		if ("object" == typeof e && "length" in e) {
			for (let s = 0; s < e.length; s += 1)
				(r = e[s]),
					t.slides[r] && t.slides[r].remove(),
					r < n && (n -= 1);
			n = Math.max(n, 0);
		} else (r = e), t.slides[r] && t.slides[r].remove(), r < n && (n -= 1), (n = Math.max(n, 0));
		t.recalcSlides(),
			s.loop && t.loopCreate(),
			(s.observer && !t.isElement) || t.update(),
			s.loop ? t.slideTo(n + t.loopedSlides, 0, !1) : t.slideTo(n, 0, !1);
	}
	function ne() {
		const e = this,
			t = [];
		for (let s = 0; s < e.slides.length; s += 1) t.push(s);
		e.removeSlide(t);
	}
	function le(e) {
		const {
			effect: t,
			swiper: s,
			on: a,
			setTranslate: i,
			setTransition: r,
			overwriteParams: n,
			perspective: l,
			recreateShadows: o,
			getEffectParams: d,
		} = e;
		let c;
		a("beforeInit", () => {
			if (s.params.effect !== t) return;
			s.classNames.push(`${s.params.containerModifierClass}${t}`),
				l &&
					l() &&
					s.classNames.push(`${s.params.containerModifierClass}3d`);
			const e = n ? n() : {};
			Object.assign(s.params, e), Object.assign(s.originalParams, e);
		}),
			a("setTranslate", () => {
				s.params.effect === t && i();
			}),
			a("setTransition", (e, a) => {
				s.params.effect === t && r(a);
			}),
			a("transitionEnd", () => {
				if (s.params.effect === t && o) {
					if (!d || !d().slideShadows) return;
					s.slides.forEach((e) => {
						e.querySelectorAll(
							".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left"
						).forEach((e) => e.remove());
					}),
						o();
				}
			}),
			a("virtualUpdate", () => {
				s.params.effect === t &&
					(s.slides.length || (c = !0),
					requestAnimationFrame(() => {
						c && s.slides && s.slides.length && (i(), (c = !1));
					}));
			});
	}
	function oe(e, t) {
		const s = h(t);
		return (
			s !== t &&
				((s.style.backfaceVisibility = "hidden"),
				(s.style["-webkit-backface-visibility"] = "hidden")),
			s
		);
	}
	function de(e) {
		let { swiper: t, duration: s, transformElements: a, allSlides: i } = e;
		const { activeIndex: r } = t;
		if (t.params.virtualTranslate && 0 !== s) {
			let e,
				s = !1;
			(e = i
				? a
				: a.filter((e) => {
						const s = e.classList.contains("swiper-slide-transform")
							? ((e) => {
									if (!e.parentElement)
										return t.slides.filter(
											(t) =>
												t.shadowEl &&
												t.shadowEl === e.parentNode
										)[0];
									return e.parentElement;
							  })(e)
							: e;
						return t.getSlideIndex(s) === r;
				  })),
				e.forEach((e) => {
					E(e, () => {
						if (s) return;
						if (!t || t.destroyed) return;
						(s = !0), (t.animating = !1);
						const e = new window.CustomEvent("transitionend", {
							bubbles: !0,
							cancelable: !0,
						});
						t.wrapperEl.dispatchEvent(e);
					});
				});
		}
	}
	function ce(e, t, s) {
		const a = "swiper-slide-shadow" + (s ? `-${s}` : ""),
			i = h(t);
		let r = i.querySelector(`.${a}`);
		return (
			r ||
				((r = g("div", "swiper-slide-shadow" + (s ? `-${s}` : ""))),
				i.append(r)),
			r
		);
	}
	Object.keys(Z).forEach((e) => {
		Object.keys(Z[e]).forEach((t) => {
			J.prototype[t] = Z[e][t];
		});
	}),
		J.use([
			function (e) {
				let { swiper: t, on: s, emit: a } = e;
				const i = r();
				let n = null,
					l = null;
				const o = () => {
						t &&
							!t.destroyed &&
							t.initialized &&
							(a("beforeResize"), a("resize"));
					},
					d = () => {
						t &&
							!t.destroyed &&
							t.initialized &&
							a("orientationchange");
					};
				s("init", () => {
					t.params.resizeObserver && void 0 !== i.ResizeObserver
						? t &&
						  !t.destroyed &&
						  t.initialized &&
						  ((n = new ResizeObserver((e) => {
								l = i.requestAnimationFrame(() => {
									const { width: s, height: a } = t;
									let i = s,
										r = a;
									e.forEach((e) => {
										let {
											contentBoxSize: s,
											contentRect: a,
											target: n,
										} = e;
										(n && n !== t.el) ||
											((i = a
												? a.width
												: (s[0] || s).inlineSize),
											(r = a
												? a.height
												: (s[0] || s).blockSize));
									}),
										(i === s && r === a) || o();
								});
						  })),
						  n.observe(t.el))
						: (i.addEventListener("resize", o),
						  i.addEventListener("orientationchange", d));
				}),
					s("destroy", () => {
						l && i.cancelAnimationFrame(l),
							n &&
								n.unobserve &&
								t.el &&
								(n.unobserve(t.el), (n = null)),
							i.removeEventListener("resize", o),
							i.removeEventListener("orientationchange", d);
					});
			},
			function (e) {
				let { swiper: t, extendParams: s, on: a, emit: i } = e;
				const n = [],
					l = r(),
					o = function (e, s) {
						void 0 === s && (s = {});
						const a = new (l.MutationObserver ||
							l.WebkitMutationObserver)((e) => {
							if (t.__preventObserver__) return;
							if (1 === e.length)
								return void i("observerUpdate", e[0]);
							const s = function () {
								i("observerUpdate", e[0]);
							};
							l.requestAnimationFrame
								? l.requestAnimationFrame(s)
								: l.setTimeout(s, 0);
						});
						a.observe(e, {
							attributes: void 0 === s.attributes || s.attributes,
							childList: void 0 === s.childList || s.childList,
							characterData:
								void 0 === s.characterData || s.characterData,
						}),
							n.push(a);
					};
				s({
					observer: !1,
					observeParents: !1,
					observeSlideChildren: !1,
				}),
					a("init", () => {
						if (t.params.observer) {
							if (t.params.observeParents) {
								const e = y(t.el);
								for (let t = 0; t < e.length; t += 1) o(e[t]);
							}
							o(t.el, {
								childList: t.params.observeSlideChildren,
							}),
								o(t.wrapperEl, { attributes: !1 });
						}
					}),
					a("destroy", () => {
						n.forEach((e) => {
							e.disconnect();
						}),
							n.splice(0, n.length);
					});
			},
		]);
	const pe = [
		function (e) {
			let t,
				{ swiper: s, extendParams: i, on: r, emit: n } = e;
			i({
				virtual: {
					enabled: !1,
					slides: [],
					cache: !0,
					renderSlide: null,
					renderExternal: null,
					renderExternalUpdate: !0,
					addSlidesBefore: 0,
					addSlidesAfter: 0,
				},
			});
			const l = a();
			s.virtual = {
				cache: {},
				from: void 0,
				to: void 0,
				slides: [],
				offset: 0,
				slidesGrid: [],
			};
			const o = l.createElement("div");
			function d(e, t) {
				const a = s.params.virtual;
				if (a.cache && s.virtual.cache[t]) return s.virtual.cache[t];
				let i;
				return (
					a.renderSlide
						? ((i = a.renderSlide.call(s, e, t)),
						  "string" == typeof i &&
								((o.innerHTML = i), (i = o.children[0])))
						: (i = s.isElement
								? g("swiper-slide")
								: g("div", s.params.slideClass)),
					i.setAttribute("data-swiper-slide-index", t),
					a.renderSlide || (i.innerHTML = e),
					a.cache && (s.virtual.cache[t] = i),
					i
				);
			}
			function c(e) {
				const {
						slidesPerView: t,
						slidesPerGroup: a,
						centeredSlides: i,
						loop: r,
					} = s.params,
					{ addSlidesBefore: l, addSlidesAfter: o } =
						s.params.virtual,
					{
						from: c,
						to: p,
						slides: u,
						slidesGrid: m,
						offset: h,
					} = s.virtual;
				s.params.cssMode || s.updateActiveIndex();
				const g = s.activeIndex || 0;
				let v, w, b;
				(v = s.rtlTranslate
					? "right"
					: s.isHorizontal()
					? "left"
					: "top"),
					i
						? ((w = Math.floor(t / 2) + a + o),
						  (b = Math.floor(t / 2) + a + l))
						: ((w = t + (a - 1) + o), (b = (r ? t : a) + l));
				let y = g - b,
					E = g + w;
				r || ((y = Math.max(y, 0)), (E = Math.min(E, u.length - 1)));
				let x = (s.slidesGrid[y] || 0) - (s.slidesGrid[0] || 0);
				function S() {
					s.updateSlides(),
						s.updateProgress(),
						s.updateSlidesClasses(),
						n("virtualUpdate");
				}
				if (
					(r && g >= b
						? ((y -= b), i || (x += s.slidesGrid[0]))
						: r && g < b && ((y = -b), i && (x += s.slidesGrid[0])),
					Object.assign(s.virtual, {
						from: y,
						to: E,
						offset: x,
						slidesGrid: s.slidesGrid,
						slidesBefore: b,
						slidesAfter: w,
					}),
					c === y && p === E && !e)
				)
					return (
						s.slidesGrid !== m &&
							x !== h &&
							s.slides.forEach((e) => {
								e.style[v] =
									x -
									Math.abs(s.cssOverflowAdjustment()) +
									"px";
							}),
						s.updateProgress(),
						void n("virtualUpdate")
					);
				if (s.params.virtual.renderExternal)
					return (
						s.params.virtual.renderExternal.call(s, {
							offset: x,
							from: y,
							to: E,
							slides: (function () {
								const e = [];
								for (let t = y; t <= E; t += 1) e.push(u[t]);
								return e;
							})(),
						}),
						void (s.params.virtual.renderExternalUpdate
							? S()
							: n("virtualUpdate"))
					);
				const T = [],
					M = [],
					C = (e) => {
						let t = e;
						return (
							e < 0
								? (t = u.length + e)
								: t >= u.length && (t -= u.length),
							t
						);
					};
				if (e)
					s.slidesEl
						.querySelectorAll(
							`.${s.params.slideClass}, swiper-slide`
						)
						.forEach((e) => {
							e.remove();
						});
				else
					for (let e = c; e <= p; e += 1)
						if (e < y || e > E) {
							const t = C(e);
							s.slidesEl
								.querySelectorAll(
									`.${s.params.slideClass}[data-swiper-slide-index="${t}"], swiper-slide[data-swiper-slide-index="${t}"]`
								)
								.forEach((e) => {
									e.remove();
								});
						}
				const P = r ? -u.length : 0,
					L = r ? 2 * u.length : u.length;
				for (let t = P; t < L; t += 1)
					if (t >= y && t <= E) {
						const s = C(t);
						void 0 === p || e
							? M.push(s)
							: (t > p && M.push(s), t < c && T.push(s));
					}
				if (
					(M.forEach((e) => {
						s.slidesEl.append(d(u[e], e));
					}),
					r)
				)
					for (let e = T.length - 1; e >= 0; e -= 1) {
						const t = T[e];
						s.slidesEl.prepend(d(u[t], t));
					}
				else
					T.sort((e, t) => t - e),
						T.forEach((e) => {
							s.slidesEl.prepend(d(u[e], e));
						});
				f(s.slidesEl, ".swiper-slide, swiper-slide").forEach((e) => {
					e.style[v] = x - Math.abs(s.cssOverflowAdjustment()) + "px";
				}),
					S();
			}
			r("beforeInit", () => {
				if (!s.params.virtual.enabled) return;
				let e;
				if (void 0 === s.passedParams.virtual.slides) {
					const t = [...s.slidesEl.children].filter((e) =>
						e.matches(`.${s.params.slideClass}, swiper-slide`)
					);
					t &&
						t.length &&
						((s.virtual.slides = [...t]),
						(e = !0),
						t.forEach((e, t) => {
							e.setAttribute("data-swiper-slide-index", t),
								(s.virtual.cache[t] = e),
								e.remove();
						}));
				}
				e || (s.virtual.slides = s.params.virtual.slides),
					s.classNames.push(
						`${s.params.containerModifierClass}virtual`
					),
					(s.params.watchSlidesProgress = !0),
					(s.originalParams.watchSlidesProgress = !0),
					s.params.initialSlide || c();
			}),
				r("setTranslate", () => {
					s.params.virtual.enabled &&
						(s.params.cssMode && !s._immediateVirtual
							? (clearTimeout(t),
							  (t = setTimeout(() => {
									c();
							  }, 100)))
							: c());
				}),
				r("init update resize", () => {
					s.params.virtual.enabled &&
						s.params.cssMode &&
						u(
							s.wrapperEl,
							"--swiper-virtual-size",
							`${s.virtualSize}px`
						);
				}),
				Object.assign(s.virtual, {
					appendSlide: function (e) {
						if ("object" == typeof e && "length" in e)
							for (let t = 0; t < e.length; t += 1)
								e[t] && s.virtual.slides.push(e[t]);
						else s.virtual.slides.push(e);
						c(!0);
					},
					prependSlide: function (e) {
						const t = s.activeIndex;
						let a = t + 1,
							i = 1;
						if (Array.isArray(e)) {
							for (let t = 0; t < e.length; t += 1)
								e[t] && s.virtual.slides.unshift(e[t]);
							(a = t + e.length), (i = e.length);
						} else s.virtual.slides.unshift(e);
						if (s.params.virtual.cache) {
							const e = s.virtual.cache,
								t = {};
							Object.keys(e).forEach((s) => {
								const a = e[s],
									r = a.getAttribute(
										"data-swiper-slide-index"
									);
								r &&
									a.setAttribute(
										"data-swiper-slide-index",
										parseInt(r, 10) + i
									),
									(t[parseInt(s, 10) + i] = a);
							}),
								(s.virtual.cache = t);
						}
						c(!0), s.slideTo(a, 0);
					},
					removeSlide: function (e) {
						if (null == e) return;
						let t = s.activeIndex;
						if (Array.isArray(e))
							for (let a = e.length - 1; a >= 0; a -= 1)
								s.virtual.slides.splice(e[a], 1),
									s.params.virtual.cache &&
										delete s.virtual.cache[e[a]],
									e[a] < t && (t -= 1),
									(t = Math.max(t, 0));
						else
							s.virtual.slides.splice(e, 1),
								s.params.virtual.cache &&
									delete s.virtual.cache[e],
								e < t && (t -= 1),
								(t = Math.max(t, 0));
						c(!0), s.slideTo(t, 0);
					},
					removeAllSlides: function () {
						(s.virtual.slides = []),
							s.params.virtual.cache && (s.virtual.cache = {}),
							c(!0),
							s.slideTo(0, 0);
					},
					update: c,
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: i, emit: n } = e;
			const l = a(),
				o = r();
			function d(e) {
				if (!t.enabled) return;
				const { rtlTranslate: s } = t;
				let a = e;
				a.originalEvent && (a = a.originalEvent);
				const i = a.keyCode || a.charCode,
					r = t.params.keyboard.pageUpDown,
					d = r && 33 === i,
					c = r && 34 === i,
					p = 37 === i,
					u = 39 === i,
					m = 38 === i,
					h = 40 === i;
				if (
					!t.allowSlideNext &&
					((t.isHorizontal() && u) || (t.isVertical() && h) || c)
				)
					return !1;
				if (
					!t.allowSlidePrev &&
					((t.isHorizontal() && p) || (t.isVertical() && m) || d)
				)
					return !1;
				if (
					!(
						a.shiftKey ||
						a.altKey ||
						a.ctrlKey ||
						a.metaKey ||
						(l.activeElement &&
							l.activeElement.nodeName &&
							("input" ===
								l.activeElement.nodeName.toLowerCase() ||
								"textarea" ===
									l.activeElement.nodeName.toLowerCase()))
					)
				) {
					if (
						t.params.keyboard.onlyInViewport &&
						(d || c || p || u || m || h)
					) {
						let e = !1;
						if (
							y(t.el, `.${t.params.slideClass}, swiper-slide`)
								.length > 0 &&
							0 ===
								y(t.el, `.${t.params.slideActiveClass}`).length
						)
							return;
						const a = t.el,
							i = a.clientWidth,
							r = a.clientHeight,
							n = o.innerWidth,
							l = o.innerHeight,
							d = v(a);
						s && (d.left -= a.scrollLeft);
						const c = [
							[d.left, d.top],
							[d.left + i, d.top],
							[d.left, d.top + r],
							[d.left + i, d.top + r],
						];
						for (let t = 0; t < c.length; t += 1) {
							const s = c[t];
							if (
								s[0] >= 0 &&
								s[0] <= n &&
								s[1] >= 0 &&
								s[1] <= l
							) {
								if (0 === s[0] && 0 === s[1]) continue;
								e = !0;
							}
						}
						if (!e) return;
					}
					t.isHorizontal()
						? ((d || c || p || u) &&
								(a.preventDefault
									? a.preventDefault()
									: (a.returnValue = !1)),
						  (((c || u) && !s) || ((d || p) && s)) &&
								t.slideNext(),
						  (((d || p) && !s) || ((c || u) && s)) &&
								t.slidePrev())
						: ((d || c || m || h) &&
								(a.preventDefault
									? a.preventDefault()
									: (a.returnValue = !1)),
						  (c || h) && t.slideNext(),
						  (d || m) && t.slidePrev()),
						n("keyPress", i);
				}
			}
			function c() {
				t.keyboard.enabled ||
					(l.addEventListener("keydown", d),
					(t.keyboard.enabled = !0));
			}
			function p() {
				t.keyboard.enabled &&
					(l.removeEventListener("keydown", d),
					(t.keyboard.enabled = !1));
			}
			(t.keyboard = { enabled: !1 }),
				s({
					keyboard: {
						enabled: !1,
						onlyInViewport: !0,
						pageUpDown: !0,
					},
				}),
				i("init", () => {
					t.params.keyboard.enabled && c();
				}),
				i("destroy", () => {
					t.keyboard.enabled && p();
				}),
				Object.assign(t.keyboard, { enable: c, disable: p });
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a, emit: i } = e;
			const o = r();
			let d;
			s({
				mousewheel: {
					enabled: !1,
					releaseOnEdges: !1,
					invert: !1,
					forceToAxis: !1,
					sensitivity: 1,
					eventsTarget: "container",
					thresholdDelta: null,
					thresholdTime: null,
					noMousewheelClass: "swiper-no-mousewheel",
				},
			}),
				(t.mousewheel = { enabled: !1 });
			let c,
				p = l();
			const u = [];
			function m() {
				t.enabled && (t.mouseEntered = !0);
			}
			function h() {
				t.enabled && (t.mouseEntered = !1);
			}
			function f(e) {
				return (
					!(
						t.params.mousewheel.thresholdDelta &&
						e.delta < t.params.mousewheel.thresholdDelta
					) &&
					!(
						t.params.mousewheel.thresholdTime &&
						l() - p < t.params.mousewheel.thresholdTime
					) &&
					((e.delta >= 6 && l() - p < 60) ||
						(e.direction < 0
							? (t.isEnd && !t.params.loop) ||
							  t.animating ||
							  (t.slideNext(), i("scroll", e.raw))
							: (t.isBeginning && !t.params.loop) ||
							  t.animating ||
							  (t.slidePrev(), i("scroll", e.raw)),
						(p = new o.Date().getTime()),
						!1))
				);
			}
			function g(e) {
				let s = e,
					a = !0;
				if (!t.enabled) return;
				if (
					e.target.closest(
						`.${t.params.mousewheel.noMousewheelClass}`
					)
				)
					return;
				const r = t.params.mousewheel;
				t.params.cssMode && s.preventDefault();
				let o = t.el;
				"container" !== t.params.mousewheel.eventsTarget &&
					(o = document.querySelector(
						t.params.mousewheel.eventsTarget
					));
				const p = o && o.contains(s.target);
				if (!t.mouseEntered && !p && !r.releaseOnEdges) return !0;
				s.originalEvent && (s = s.originalEvent);
				let m = 0;
				const h = t.rtlTranslate ? -1 : 1,
					g = (function (e) {
						let t = 0,
							s = 0,
							a = 0,
							i = 0;
						return (
							"detail" in e && (s = e.detail),
							"wheelDelta" in e && (s = -e.wheelDelta / 120),
							"wheelDeltaY" in e && (s = -e.wheelDeltaY / 120),
							"wheelDeltaX" in e && (t = -e.wheelDeltaX / 120),
							"axis" in e &&
								e.axis === e.HORIZONTAL_AXIS &&
								((t = s), (s = 0)),
							(a = 10 * t),
							(i = 10 * s),
							"deltaY" in e && (i = e.deltaY),
							"deltaX" in e && (a = e.deltaX),
							e.shiftKey && !a && ((a = i), (i = 0)),
							(a || i) &&
								e.deltaMode &&
								(1 === e.deltaMode
									? ((a *= 40), (i *= 40))
									: ((a *= 800), (i *= 800))),
							a && !t && (t = a < 1 ? -1 : 1),
							i && !s && (s = i < 1 ? -1 : 1),
							{ spinX: t, spinY: s, pixelX: a, pixelY: i }
						);
					})(s);
				if (r.forceToAxis)
					if (t.isHorizontal()) {
						if (!(Math.abs(g.pixelX) > Math.abs(g.pixelY)))
							return !0;
						m = -g.pixelX * h;
					} else {
						if (!(Math.abs(g.pixelY) > Math.abs(g.pixelX)))
							return !0;
						m = -g.pixelY;
					}
				else
					m =
						Math.abs(g.pixelX) > Math.abs(g.pixelY)
							? -g.pixelX * h
							: -g.pixelY;
				if (0 === m) return !0;
				r.invert && (m = -m);
				let v = t.getTranslate() + m * r.sensitivity;
				if (
					(v >= t.minTranslate() && (v = t.minTranslate()),
					v <= t.maxTranslate() && (v = t.maxTranslate()),
					(a =
						!!t.params.loop ||
						!(v === t.minTranslate() || v === t.maxTranslate())),
					a && t.params.nested && s.stopPropagation(),
					t.params.freeMode && t.params.freeMode.enabled)
				) {
					const e = {
							time: l(),
							delta: Math.abs(m),
							direction: Math.sign(m),
						},
						a =
							c &&
							e.time < c.time + 500 &&
							e.delta <= c.delta &&
							e.direction === c.direction;
					if (!a) {
						c = void 0;
						let l = t.getTranslate() + m * r.sensitivity;
						const o = t.isBeginning,
							p = t.isEnd;
						if (
							(l >= t.minTranslate() && (l = t.minTranslate()),
							l <= t.maxTranslate() && (l = t.maxTranslate()),
							t.setTransition(0),
							t.setTranslate(l),
							t.updateProgress(),
							t.updateActiveIndex(),
							t.updateSlidesClasses(),
							((!o && t.isBeginning) || (!p && t.isEnd)) &&
								t.updateSlidesClasses(),
							t.params.loop &&
								t.loopFix({
									direction:
										e.direction < 0 ? "next" : "prev",
									byMousewheel: !0,
								}),
							t.params.freeMode.sticky)
						) {
							clearTimeout(d),
								(d = void 0),
								u.length >= 15 && u.shift();
							const s = u.length ? u[u.length - 1] : void 0,
								a = u[0];
							if (
								(u.push(e),
								s &&
									(e.delta > s.delta ||
										e.direction !== s.direction))
							)
								u.splice(0);
							else if (
								u.length >= 15 &&
								e.time - a.time < 500 &&
								a.delta - e.delta >= 1 &&
								e.delta <= 6
							) {
								const s = m > 0 ? 0.8 : 0.2;
								(c = e),
									u.splice(0),
									(d = n(() => {
										t.slideToClosest(
											t.params.speed,
											!0,
											void 0,
											s
										);
									}, 0));
							}
							d ||
								(d = n(() => {
									(c = e),
										u.splice(0),
										t.slideToClosest(
											t.params.speed,
											!0,
											void 0,
											0.5
										);
								}, 500));
						}
						if (
							(a || i("scroll", s),
							t.params.autoplay &&
								t.params.autoplayDisableOnInteraction &&
								t.autoplay.stop(),
							l === t.minTranslate() || l === t.maxTranslate())
						)
							return !0;
					}
				} else {
					const s = {
						time: l(),
						delta: Math.abs(m),
						direction: Math.sign(m),
						raw: e,
					};
					u.length >= 2 && u.shift();
					const a = u.length ? u[u.length - 1] : void 0;
					if (
						(u.push(s),
						a
							? (s.direction !== a.direction ||
									s.delta > a.delta ||
									s.time > a.time + 150) &&
							  f(s)
							: f(s),
						(function (e) {
							const s = t.params.mousewheel;
							if (e.direction < 0) {
								if (
									t.isEnd &&
									!t.params.loop &&
									s.releaseOnEdges
								)
									return !0;
							} else if (
								t.isBeginning &&
								!t.params.loop &&
								s.releaseOnEdges
							)
								return !0;
							return !1;
						})(s))
					)
						return !0;
				}
				return (
					s.preventDefault
						? s.preventDefault()
						: (s.returnValue = !1),
					!1
				);
			}
			function v(e) {
				let s = t.el;
				"container" !== t.params.mousewheel.eventsTarget &&
					(s = document.querySelector(
						t.params.mousewheel.eventsTarget
					)),
					s[e]("mouseenter", m),
					s[e]("mouseleave", h),
					s[e]("wheel", g);
			}
			function w() {
				return t.params.cssMode
					? (t.wrapperEl.removeEventListener("wheel", g), !0)
					: !t.mousewheel.enabled &&
							(v("addEventListener"),
							(t.mousewheel.enabled = !0),
							!0);
			}
			function b() {
				return t.params.cssMode
					? (t.wrapperEl.addEventListener(event, g), !0)
					: !!t.mousewheel.enabled &&
							(v("removeEventListener"),
							(t.mousewheel.enabled = !1),
							!0);
			}
			a("init", () => {
				!t.params.mousewheel.enabled && t.params.cssMode && b(),
					t.params.mousewheel.enabled && w();
			}),
				a("destroy", () => {
					t.params.cssMode && w(), t.mousewheel.enabled && b();
				}),
				Object.assign(t.mousewheel, { enable: w, disable: b });
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a, emit: i } = e;
			s({
				navigation: {
					nextEl: null,
					prevEl: null,
					hideOnClick: !1,
					disabledClass: "swiper-button-disabled",
					hiddenClass: "swiper-button-hidden",
					lockClass: "swiper-button-lock",
					navigationDisabledClass: "swiper-navigation-disabled",
				},
			}),
				(t.navigation = { nextEl: null, prevEl: null });
			const r = (e) => (
				Array.isArray(e) || (e = [e].filter((e) => !!e)), e
			);
			function n(e) {
				let s;
				return e &&
					"string" == typeof e &&
					t.isElement &&
					((s = t.el.shadowRoot.querySelector(e)), s)
					? s
					: (e &&
							("string" == typeof e &&
								(s = [...document.querySelectorAll(e)]),
							t.params.uniqueNavElements &&
								"string" == typeof e &&
								s.length > 1 &&
								1 === t.el.querySelectorAll(e).length &&
								(s = t.el.querySelector(e))),
					  e && !s ? e : s);
			}
			function l(e, s) {
				const a = t.params.navigation;
				(e = r(e)).forEach((e) => {
					e &&
						(e.classList[s ? "add" : "remove"](
							...a.disabledClass.split(" ")
						),
						"BUTTON" === e.tagName && (e.disabled = s),
						t.params.watchOverflow &&
							t.enabled &&
							e.classList[t.isLocked ? "add" : "remove"](
								a.lockClass
							));
				});
			}
			function o() {
				const { nextEl: e, prevEl: s } = t.navigation;
				if (t.params.loop) return l(s, !1), void l(e, !1);
				l(s, t.isBeginning && !t.params.rewind),
					l(e, t.isEnd && !t.params.rewind);
			}
			function d(e) {
				e.preventDefault(),
					(!t.isBeginning || t.params.loop || t.params.rewind) &&
						(t.slidePrev(), i("navigationPrev"));
			}
			function c(e) {
				e.preventDefault(),
					(!t.isEnd || t.params.loop || t.params.rewind) &&
						(t.slideNext(), i("navigationNext"));
			}
			function p() {
				const e = t.params.navigation;
				if (
					((t.params.navigation = ee(
						t,
						t.originalParams.navigation,
						t.params.navigation,
						{
							nextEl: "swiper-button-next",
							prevEl: "swiper-button-prev",
						}
					)),
					!e.nextEl && !e.prevEl)
				)
					return;
				let s = n(e.nextEl),
					a = n(e.prevEl);
				Object.assign(t.navigation, { nextEl: s, prevEl: a }),
					(s = r(s)),
					(a = r(a));
				const i = (s, a) => {
					s && s.addEventListener("click", "next" === a ? c : d),
						!t.enabled &&
							s &&
							s.classList.add(...e.lockClass.split(" "));
				};
				s.forEach((e) => i(e, "next")), a.forEach((e) => i(e, "prev"));
			}
			function u() {
				let { nextEl: e, prevEl: s } = t.navigation;
				(e = r(e)), (s = r(s));
				const a = (e, s) => {
					e.removeEventListener("click", "next" === s ? c : d),
						e.classList.remove(
							...t.params.navigation.disabledClass.split(" ")
						);
				};
				e.forEach((e) => a(e, "next")), s.forEach((e) => a(e, "prev"));
			}
			a("init", () => {
				!1 === t.params.navigation.enabled ? m() : (p(), o());
			}),
				a("toEdge fromEdge lock unlock", () => {
					o();
				}),
				a("destroy", () => {
					u();
				}),
				a("enable disable", () => {
					let { nextEl: e, prevEl: s } = t.navigation;
					(e = r(e)),
						(s = r(s)),
						[...e, ...s]
							.filter((e) => !!e)
							.forEach((e) =>
								e.classList[t.enabled ? "remove" : "add"](
									t.params.navigation.lockClass
								)
							);
				}),
				a("click", (e, s) => {
					let { nextEl: a, prevEl: n } = t.navigation;
					(a = r(a)), (n = r(n));
					const l = s.target;
					if (
						t.params.navigation.hideOnClick &&
						!n.includes(l) &&
						!a.includes(l)
					) {
						if (
							t.pagination &&
							t.params.pagination &&
							t.params.pagination.clickable &&
							(t.pagination.el === l ||
								t.pagination.el.contains(l))
						)
							return;
						let e;
						a.length
							? (e = a[0].classList.contains(
									t.params.navigation.hiddenClass
							  ))
							: n.length &&
							  (e = n[0].classList.contains(
									t.params.navigation.hiddenClass
							  )),
							i(!0 === e ? "navigationShow" : "navigationHide"),
							[...a, ...n]
								.filter((e) => !!e)
								.forEach((e) =>
									e.classList.toggle(
										t.params.navigation.hiddenClass
									)
								);
					}
				});
			const m = () => {
				t.el.classList.add(
					...t.params.navigation.navigationDisabledClass.split(" ")
				),
					u();
			};
			Object.assign(t.navigation, {
				enable: () => {
					t.el.classList.remove(
						...t.params.navigation.navigationDisabledClass.split(
							" "
						)
					),
						p(),
						o();
				},
				disable: m,
				update: o,
				init: p,
				destroy: u,
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a, emit: i } = e;
			const r = "swiper-pagination";
			let n;
			s({
				pagination: {
					el: null,
					bulletElement: "span",
					clickable: !1,
					hideOnClick: !1,
					renderBullet: null,
					renderProgressbar: null,
					renderFraction: null,
					renderCustom: null,
					progressbarOpposite: !1,
					type: "bullets",
					dynamicBullets: !1,
					dynamicMainBullets: 1,
					formatFractionCurrent: (e) => e,
					formatFractionTotal: (e) => e,
					bulletClass: `${r}-bullet`,
					bulletActiveClass: `${r}-bullet-active`,
					modifierClass: `${r}-`,
					currentClass: `${r}-current`,
					totalClass: `${r}-total`,
					hiddenClass: `${r}-hidden`,
					progressbarFillClass: `${r}-progressbar-fill`,
					progressbarOppositeClass: `${r}-progressbar-opposite`,
					clickableClass: `${r}-clickable`,
					lockClass: `${r}-lock`,
					horizontalClass: `${r}-horizontal`,
					verticalClass: `${r}-vertical`,
					paginationDisabledClass: `${r}-disabled`,
				},
			}),
				(t.pagination = { el: null, bullets: [] });
			let l = 0;
			const o = (e) => (
				Array.isArray(e) || (e = [e].filter((e) => !!e)), e
			);
			function d() {
				return (
					!t.params.pagination.el ||
					!t.pagination.el ||
					(Array.isArray(t.pagination.el) &&
						0 === t.pagination.el.length)
				);
			}
			function c(e, s) {
				const { bulletActiveClass: a } = t.params.pagination;
				e &&
					(e =
						e[
							("prev" === s ? "previous" : "next") +
								"ElementSibling"
						]) &&
					(e.classList.add(`${a}-${s}`),
					(e =
						e[
							("prev" === s ? "previous" : "next") +
								"ElementSibling"
						]) && e.classList.add(`${a}-${s}-${s}`));
			}
			function p(e) {
				const s = e.target.closest(te(t.params.pagination.bulletClass));
				if (!s) return;
				e.preventDefault();
				const a = b(s) * t.params.slidesPerGroup;
				if (t.params.loop) {
					if (t.realIndex === a) return;
					const e = t.getSlideIndexByData(a),
						s = t.getSlideIndexByData(t.realIndex);
					e > t.slides.length - t.loopedSlides &&
						t.loopFix({
							direction: e > s ? "next" : "prev",
							activeSlideIndex: e,
							slideTo: !1,
						}),
						t.slideToLoop(a);
				} else t.slideTo(a);
			}
			function u() {
				const e = t.rtl,
					s = t.params.pagination;
				if (d()) return;
				let a,
					r,
					p = t.pagination.el;
				p = o(p);
				const u =
						t.virtual && t.params.virtual.enabled
							? t.virtual.slides.length
							: t.slides.length,
					m = t.params.loop
						? Math.ceil(u / t.params.slidesPerGroup)
						: t.snapGrid.length;
				if (
					(t.params.loop
						? ((r = t.previousRealIndex || 0),
						  (a =
								t.params.slidesPerGroup > 1
									? Math.floor(
											t.realIndex /
												t.params.slidesPerGroup
									  )
									: t.realIndex))
						: void 0 !== t.snapIndex
						? ((a = t.snapIndex), (r = t.previousSnapIndex))
						: ((r = t.previousIndex || 0),
						  (a = t.activeIndex || 0)),
					"bullets" === s.type &&
						t.pagination.bullets &&
						t.pagination.bullets.length > 0)
				) {
					const i = t.pagination.bullets;
					let o, d, u;
					if (
						(s.dynamicBullets &&
							((n = x(
								i[0],
								t.isHorizontal() ? "width" : "height",
								!0
							)),
							p.forEach((e) => {
								e.style[t.isHorizontal() ? "width" : "height"] =
									n * (s.dynamicMainBullets + 4) + "px";
							}),
							s.dynamicMainBullets > 1 &&
								void 0 !== r &&
								((l += a - (r || 0)),
								l > s.dynamicMainBullets - 1
									? (l = s.dynamicMainBullets - 1)
									: l < 0 && (l = 0)),
							(o = Math.max(a - l, 0)),
							(d =
								o +
								(Math.min(i.length, s.dynamicMainBullets) - 1)),
							(u = (d + o) / 2)),
						i.forEach((e) => {
							const t = [
								...[
									"",
									"-next",
									"-next-next",
									"-prev",
									"-prev-prev",
									"-main",
								].map((e) => `${s.bulletActiveClass}${e}`),
							]
								.map((e) =>
									"string" == typeof e && e.includes(" ")
										? e.split(" ")
										: e
								)
								.flat();
							e.classList.remove(...t);
						}),
						p.length > 1)
					)
						i.forEach((e) => {
							const i = b(e);
							i === a
								? e.classList.add(
										...s.bulletActiveClass.split(" ")
								  )
								: t.isElement &&
								  e.setAttribute("part", "bullet"),
								s.dynamicBullets &&
									(i >= o &&
										i <= d &&
										e.classList.add(
											...`${s.bulletActiveClass}-main`.split(
												" "
											)
										),
									i === o && c(e, "prev"),
									i === d && c(e, "next"));
						});
					else {
						const e = i[a];
						if (
							(e &&
								e.classList.add(
									...s.bulletActiveClass.split(" ")
								),
							t.isElement &&
								i.forEach((e, t) => {
									e.setAttribute(
										"part",
										t === a ? "bullet-active" : "bullet"
									);
								}),
							s.dynamicBullets)
						) {
							const e = i[o],
								t = i[d];
							for (let e = o; e <= d; e += 1)
								i[e] &&
									i[e].classList.add(
										...`${s.bulletActiveClass}-main`.split(
											" "
										)
									);
							c(e, "prev"), c(t, "next");
						}
					}
					if (s.dynamicBullets) {
						const a = Math.min(i.length, s.dynamicMainBullets + 4),
							r = (n * a - n) / 2 - u * n,
							l = e ? "right" : "left";
						i.forEach((e) => {
							e.style[t.isHorizontal() ? l : "top"] = `${r}px`;
						});
					}
				}
				p.forEach((e, r) => {
					if (
						("fraction" === s.type &&
							(e
								.querySelectorAll(te(s.currentClass))
								.forEach((e) => {
									e.textContent = s.formatFractionCurrent(
										a + 1
									);
								}),
							e
								.querySelectorAll(te(s.totalClass))
								.forEach((e) => {
									e.textContent = s.formatFractionTotal(m);
								})),
						"progressbar" === s.type)
					) {
						let i;
						i = s.progressbarOpposite
							? t.isHorizontal()
								? "vertical"
								: "horizontal"
							: t.isHorizontal()
							? "horizontal"
							: "vertical";
						const r = (a + 1) / m;
						let n = 1,
							l = 1;
						"horizontal" === i ? (n = r) : (l = r),
							e
								.querySelectorAll(te(s.progressbarFillClass))
								.forEach((e) => {
									(e.style.transform = `translate3d(0,0,0) scaleX(${n}) scaleY(${l})`),
										(e.style.transitionDuration = `${t.params.speed}ms`);
								});
					}
					"custom" === s.type && s.renderCustom
						? ((e.innerHTML = s.renderCustom(t, a + 1, m)),
						  0 === r && i("paginationRender", e))
						: (0 === r && i("paginationRender", e),
						  i("paginationUpdate", e)),
						t.params.watchOverflow &&
							t.enabled &&
							e.classList[t.isLocked ? "add" : "remove"](
								s.lockClass
							);
				});
			}
			function m() {
				const e = t.params.pagination;
				if (d()) return;
				const s =
					t.virtual && t.params.virtual.enabled
						? t.virtual.slides.length
						: t.slides.length;
				let a = t.pagination.el;
				a = o(a);
				let r = "";
				if ("bullets" === e.type) {
					let a = t.params.loop
						? Math.ceil(s / t.params.slidesPerGroup)
						: t.snapGrid.length;
					t.params.freeMode &&
						t.params.freeMode.enabled &&
						a > s &&
						(a = s);
					for (let s = 0; s < a; s += 1)
						e.renderBullet
							? (r += e.renderBullet.call(t, s, e.bulletClass))
							: (r += `<${e.bulletElement} ${
									t.isElement ? 'part="bullet"' : ""
							  } class="${e.bulletClass}"></${
									e.bulletElement
							  }>`);
				}
				"fraction" === e.type &&
					(r = e.renderFraction
						? e.renderFraction.call(t, e.currentClass, e.totalClass)
						: `<span class="${e.currentClass}"></span> / <span class="${e.totalClass}"></span>`),
					"progressbar" === e.type &&
						(r = e.renderProgressbar
							? e.renderProgressbar.call(
									t,
									e.progressbarFillClass
							  )
							: `<span class="${e.progressbarFillClass}"></span>`),
					(t.pagination.bullets = []),
					a.forEach((s) => {
						"custom" !== e.type && (s.innerHTML = r || ""),
							"bullets" === e.type &&
								t.pagination.bullets.push(
									...s.querySelectorAll(te(e.bulletClass))
								);
					}),
					"custom" !== e.type && i("paginationRender", a[0]);
			}
			function h() {
				t.params.pagination = ee(
					t,
					t.originalParams.pagination,
					t.params.pagination,
					{ el: "swiper-pagination" }
				);
				const e = t.params.pagination;
				if (!e.el) return;
				let s;
				"string" == typeof e.el &&
					t.isElement &&
					(s = t.el.shadowRoot.querySelector(e.el)),
					s ||
						"string" != typeof e.el ||
						(s = [...document.querySelectorAll(e.el)]),
					s || (s = e.el),
					s &&
						0 !== s.length &&
						(t.params.uniqueNavElements &&
							"string" == typeof e.el &&
							Array.isArray(s) &&
							s.length > 1 &&
							((s = [...t.el.querySelectorAll(e.el)]),
							s.length > 1 &&
								(s = s.filter(
									(e) => y(e, ".swiper")[0] === t.el
								)[0])),
						Array.isArray(s) && 1 === s.length && (s = s[0]),
						Object.assign(t.pagination, { el: s }),
						(s = o(s)),
						s.forEach((s) => {
							"bullets" === e.type &&
								e.clickable &&
								s.classList.add(e.clickableClass),
								s.classList.add(e.modifierClass + e.type),
								s.classList.add(
									t.isHorizontal()
										? e.horizontalClass
										: e.verticalClass
								),
								"bullets" === e.type &&
									e.dynamicBullets &&
									(s.classList.add(
										`${e.modifierClass}${e.type}-dynamic`
									),
									(l = 0),
									e.dynamicMainBullets < 1 &&
										(e.dynamicMainBullets = 1)),
								"progressbar" === e.type &&
									e.progressbarOpposite &&
									s.classList.add(e.progressbarOppositeClass),
								e.clickable && s.addEventListener("click", p),
								t.enabled || s.classList.add(e.lockClass);
						}));
			}
			function f() {
				const e = t.params.pagination;
				if (d()) return;
				let s = t.pagination.el;
				s &&
					((s = o(s)),
					s.forEach((s) => {
						s.classList.remove(e.hiddenClass),
							s.classList.remove(e.modifierClass + e.type),
							s.classList.remove(
								t.isHorizontal()
									? e.horizontalClass
									: e.verticalClass
							),
							e.clickable && s.removeEventListener("click", p);
					})),
					t.pagination.bullets &&
						t.pagination.bullets.forEach((t) =>
							t.classList.remove(
								...e.bulletActiveClass.split(" ")
							)
						);
			}
			a("changeDirection", () => {
				if (!t.pagination || !t.pagination.el) return;
				const e = t.params.pagination;
				let { el: s } = t.pagination;
				(s = o(s)),
					s.forEach((s) => {
						s.classList.remove(e.horizontalClass, e.verticalClass),
							s.classList.add(
								t.isHorizontal()
									? e.horizontalClass
									: e.verticalClass
							);
					});
			}),
				a("init", () => {
					!1 === t.params.pagination.enabled ? g() : (h(), m(), u());
				}),
				a("activeIndexChange", () => {
					void 0 === t.snapIndex && u();
				}),
				a("snapIndexChange", () => {
					u();
				}),
				a("snapGridLengthChange", () => {
					m(), u();
				}),
				a("destroy", () => {
					f();
				}),
				a("enable disable", () => {
					let { el: e } = t.pagination;
					e &&
						((e = o(e)),
						e.forEach((e) =>
							e.classList[t.enabled ? "remove" : "add"](
								t.params.pagination.lockClass
							)
						));
				}),
				a("lock unlock", () => {
					u();
				}),
				a("click", (e, s) => {
					const a = s.target;
					let { el: r } = t.pagination;
					if (
						(Array.isArray(r) || (r = [r].filter((e) => !!e)),
						t.params.pagination.el &&
							t.params.pagination.hideOnClick &&
							r &&
							r.length > 0 &&
							!a.classList.contains(
								t.params.pagination.bulletClass
							))
					) {
						if (
							t.navigation &&
							((t.navigation.nextEl &&
								a === t.navigation.nextEl) ||
								(t.navigation.prevEl &&
									a === t.navigation.prevEl))
						)
							return;
						const e = r[0].classList.contains(
							t.params.pagination.hiddenClass
						);
						i(!0 === e ? "paginationShow" : "paginationHide"),
							r.forEach((e) =>
								e.classList.toggle(
									t.params.pagination.hiddenClass
								)
							);
					}
				});
			const g = () => {
				t.el.classList.add(t.params.pagination.paginationDisabledClass);
				let { el: e } = t.pagination;
				e &&
					((e = o(e)),
					e.forEach((e) =>
						e.classList.add(
							t.params.pagination.paginationDisabledClass
						)
					)),
					f();
			};
			Object.assign(t.pagination, {
				enable: () => {
					t.el.classList.remove(
						t.params.pagination.paginationDisabledClass
					);
					let { el: e } = t.pagination;
					e &&
						((e = o(e)),
						e.forEach((e) =>
							e.classList.remove(
								t.params.pagination.paginationDisabledClass
							)
						)),
						h(),
						m(),
						u();
				},
				disable: g,
				render: m,
				update: u,
				init: h,
				destroy: f,
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: i, emit: r } = e;
			const l = a();
			let o,
				d,
				c,
				p,
				u = !1,
				m = null,
				h = null;
			function f() {
				if (!t.params.scrollbar.el || !t.scrollbar.el) return;
				const { scrollbar: e, rtlTranslate: s } = t,
					{ dragEl: a, el: i } = e,
					r = t.params.scrollbar,
					n = t.params.loop ? t.progressLoop : t.progress;
				let l = d,
					o = (c - d) * n;
				s
					? ((o = -o),
					  o > 0
							? ((l = d - o), (o = 0))
							: -o + d > c && (l = c + o))
					: o < 0
					? ((l = d + o), (o = 0))
					: o + d > c && (l = c - o),
					t.isHorizontal()
						? ((a.style.transform = `translate3d(${o}px, 0, 0)`),
						  (a.style.width = `${l}px`))
						: ((a.style.transform = `translate3d(0px, ${o}px, 0)`),
						  (a.style.height = `${l}px`)),
					r.hide &&
						(clearTimeout(m),
						(i.style.opacity = 1),
						(m = setTimeout(() => {
							(i.style.opacity = 0),
								(i.style.transitionDuration = "400ms");
						}, 1e3)));
			}
			function w() {
				if (!t.params.scrollbar.el || !t.scrollbar.el) return;
				const { scrollbar: e } = t,
					{ dragEl: s, el: a } = e;
				(s.style.width = ""),
					(s.style.height = ""),
					(c = t.isHorizontal() ? a.offsetWidth : a.offsetHeight),
					(p =
						t.size /
						(t.virtualSize +
							t.params.slidesOffsetBefore -
							(t.params.centeredSlides ? t.snapGrid[0] : 0))),
					(d =
						"auto" === t.params.scrollbar.dragSize
							? c * p
							: parseInt(t.params.scrollbar.dragSize, 10)),
					t.isHorizontal()
						? (s.style.width = `${d}px`)
						: (s.style.height = `${d}px`),
					(a.style.display = p >= 1 ? "none" : ""),
					t.params.scrollbar.hide && (a.style.opacity = 0),
					t.params.watchOverflow &&
						t.enabled &&
						e.el.classList[t.isLocked ? "add" : "remove"](
							t.params.scrollbar.lockClass
						);
			}
			function b(e) {
				return t.isHorizontal() ? e.clientX : e.clientY;
			}
			function y(e) {
				const { scrollbar: s, rtlTranslate: a } = t,
					{ el: i } = s;
				let r;
				(r =
					(b(e) -
						v(i)[t.isHorizontal() ? "left" : "top"] -
						(null !== o ? o : d / 2)) /
					(c - d)),
					(r = Math.max(Math.min(r, 1), 0)),
					a && (r = 1 - r);
				const n =
					t.minTranslate() +
					(t.maxTranslate() - t.minTranslate()) * r;
				t.updateProgress(n),
					t.setTranslate(n),
					t.updateActiveIndex(),
					t.updateSlidesClasses();
			}
			function E(e) {
				const s = t.params.scrollbar,
					{ scrollbar: a, wrapperEl: i } = t,
					{ el: n, dragEl: l } = a;
				(u = !0),
					(o =
						e.target === l
							? b(e) -
							  e.target.getBoundingClientRect()[
									t.isHorizontal() ? "left" : "top"
							  ]
							: null),
					e.preventDefault(),
					e.stopPropagation(),
					(i.style.transitionDuration = "100ms"),
					(l.style.transitionDuration = "100ms"),
					y(e),
					clearTimeout(h),
					(n.style.transitionDuration = "0ms"),
					s.hide && (n.style.opacity = 1),
					t.params.cssMode &&
						(t.wrapperEl.style["scroll-snap-type"] = "none"),
					r("scrollbarDragStart", e);
			}
			function x(e) {
				const { scrollbar: s, wrapperEl: a } = t,
					{ el: i, dragEl: n } = s;
				u &&
					(e.preventDefault
						? e.preventDefault()
						: (e.returnValue = !1),
					y(e),
					(a.style.transitionDuration = "0ms"),
					(i.style.transitionDuration = "0ms"),
					(n.style.transitionDuration = "0ms"),
					r("scrollbarDragMove", e));
			}
			function S(e) {
				const s = t.params.scrollbar,
					{ scrollbar: a, wrapperEl: i } = t,
					{ el: l } = a;
				u &&
					((u = !1),
					t.params.cssMode &&
						((t.wrapperEl.style["scroll-snap-type"] = ""),
						(i.style.transitionDuration = "")),
					s.hide &&
						(clearTimeout(h),
						(h = n(() => {
							(l.style.opacity = 0),
								(l.style.transitionDuration = "400ms");
						}, 1e3))),
					r("scrollbarDragEnd", e),
					s.snapOnRelease && t.slideToClosest());
			}
			function T(e) {
				const { scrollbar: s, params: a } = t,
					i = s.el;
				if (!i) return;
				const r = i,
					n = !!a.passiveListeners && { passive: !1, capture: !1 },
					o = !!a.passiveListeners && { passive: !0, capture: !1 };
				if (!r) return;
				const d =
					"on" === e ? "addEventListener" : "removeEventListener";
				r[d]("pointerdown", E, n),
					l[d]("pointermove", x, n),
					l[d]("pointerup", S, o);
			}
			function M() {
				const { scrollbar: e, el: s } = t;
				t.params.scrollbar = ee(
					t,
					t.originalParams.scrollbar,
					t.params.scrollbar,
					{ el: "swiper-scrollbar" }
				);
				const a = t.params.scrollbar;
				if (!a.el) return;
				let i, r;
				"string" == typeof a.el &&
					t.isElement &&
					(i = t.el.shadowRoot.querySelector(a.el)),
					i || "string" != typeof a.el
						? i || (i = a.el)
						: (i = l.querySelectorAll(a.el)),
					t.params.uniqueNavElements &&
						"string" == typeof a.el &&
						i.length > 1 &&
						1 === s.querySelectorAll(a.el).length &&
						(i = s.querySelector(a.el)),
					i.length > 0 && (i = i[0]),
					i.classList.add(
						t.isHorizontal() ? a.horizontalClass : a.verticalClass
					),
					i &&
						((r = i.querySelector(
							`.${t.params.scrollbar.dragClass}`
						)),
						r ||
							((r = g("div", t.params.scrollbar.dragClass)),
							i.append(r))),
					Object.assign(e, { el: i, dragEl: r }),
					a.draggable &&
						t.params.scrollbar.el &&
						t.scrollbar.el &&
						T("on"),
					i &&
						i.classList[t.enabled ? "remove" : "add"](
							t.params.scrollbar.lockClass
						);
			}
			function C() {
				const e = t.params.scrollbar,
					s = t.scrollbar.el;
				s &&
					s.classList.remove(
						t.isHorizontal() ? e.horizontalClass : e.verticalClass
					),
					t.params.scrollbar.el && t.scrollbar.el && T("off");
			}
			s({
				scrollbar: {
					el: null,
					dragSize: "auto",
					hide: !1,
					draggable: !1,
					snapOnRelease: !0,
					lockClass: "swiper-scrollbar-lock",
					dragClass: "swiper-scrollbar-drag",
					scrollbarDisabledClass: "swiper-scrollbar-disabled",
					horizontalClass: "swiper-scrollbar-horizontal",
					verticalClass: "swiper-scrollbar-vertical",
				},
			}),
				(t.scrollbar = { el: null, dragEl: null }),
				i("init", () => {
					!1 === t.params.scrollbar.enabled ? P() : (M(), w(), f());
				}),
				i("update resize observerUpdate lock unlock", () => {
					w();
				}),
				i("setTranslate", () => {
					f();
				}),
				i("setTransition", (e, s) => {
					!(function (e) {
						t.params.scrollbar.el &&
							t.scrollbar.el &&
							(t.scrollbar.dragEl.style.transitionDuration = `${e}ms`);
					})(s);
				}),
				i("enable disable", () => {
					const { el: e } = t.scrollbar;
					e &&
						e.classList[t.enabled ? "remove" : "add"](
							t.params.scrollbar.lockClass
						);
				}),
				i("destroy", () => {
					C();
				});
			const P = () => {
				t.el.classList.add(t.params.scrollbar.scrollbarDisabledClass),
					t.scrollbar.el &&
						t.scrollbar.el.classList.add(
							t.params.scrollbar.scrollbarDisabledClass
						),
					C();
			};
			Object.assign(t.scrollbar, {
				enable: () => {
					t.el.classList.remove(
						t.params.scrollbar.scrollbarDisabledClass
					),
						t.scrollbar.el &&
							t.scrollbar.el.classList.remove(
								t.params.scrollbar.scrollbarDisabledClass
							),
						M(),
						w(),
						f();
				},
				disable: P,
				updateSize: w,
				setTranslate: f,
				init: M,
				destroy: C,
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({ parallax: { enabled: !1 } });
			const i = (e, s) => {
					const { rtl: a } = t,
						i = a ? -1 : 1,
						r = e.getAttribute("data-swiper-parallax") || "0";
					let n = e.getAttribute("data-swiper-parallax-x"),
						l = e.getAttribute("data-swiper-parallax-y");
					const o = e.getAttribute("data-swiper-parallax-scale"),
						d = e.getAttribute("data-swiper-parallax-opacity"),
						c = e.getAttribute("data-swiper-parallax-rotate");
					if (
						(n || l
							? ((n = n || "0"), (l = l || "0"))
							: t.isHorizontal()
							? ((n = r), (l = "0"))
							: ((l = r), (n = "0")),
						(n =
							n.indexOf("%") >= 0
								? parseInt(n, 10) * s * i + "%"
								: n * s * i + "px"),
						(l =
							l.indexOf("%") >= 0
								? parseInt(l, 10) * s + "%"
								: l * s + "px"),
						null != d)
					) {
						const t = d - (d - 1) * (1 - Math.abs(s));
						e.style.opacity = t;
					}
					let p = `translate3d(${n}, ${l}, 0px)`;
					if (null != o) {
						p += ` scale(${o - (o - 1) * (1 - Math.abs(s))})`;
					}
					if (c && null != c) {
						p += ` rotate(${c * s * -1}deg)`;
					}
					e.style.transform = p;
				},
				r = () => {
					const { el: e, slides: s, progress: a, snapGrid: r } = t;
					f(
						e,
						"[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]"
					).forEach((e) => {
						i(e, a);
					}),
						s.forEach((e, s) => {
							let n = e.progress;
							t.params.slidesPerGroup > 1 &&
								"auto" !== t.params.slidesPerView &&
								(n += Math.ceil(s / 2) - a * (r.length - 1)),
								(n = Math.min(Math.max(n, -1), 1)),
								e
									.querySelectorAll(
										"[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale], [data-swiper-parallax-rotate]"
									)
									.forEach((e) => {
										i(e, n);
									});
						});
				};
			a("beforeInit", () => {
				t.params.parallax.enabled &&
					((t.params.watchSlidesProgress = !0),
					(t.originalParams.watchSlidesProgress = !0));
			}),
				a("init", () => {
					t.params.parallax.enabled && r();
				}),
				a("setTranslate", () => {
					t.params.parallax.enabled && r();
				}),
				a("setTransition", (e, s) => {
					t.params.parallax.enabled &&
						(function (e) {
							void 0 === e && (e = t.params.speed);
							const { el: s } = t;
							s.querySelectorAll(
								"[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]"
							).forEach((t) => {
								let s =
									parseInt(
										t.getAttribute(
											"data-swiper-parallax-duration"
										),
										10
									) || e;
								0 === e && (s = 0),
									(t.style.transitionDuration = `${s}ms`);
							});
						})(s);
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a, emit: i } = e;
			const n = r();
			s({
				zoom: {
					enabled: !1,
					maxRatio: 3,
					minRatio: 1,
					toggle: !0,
					containerClass: "swiper-zoom-container",
					zoomedSlideClass: "swiper-slide-zoomed",
				},
			}),
				(t.zoom = { enabled: !1 });
			let l,
				d,
				c = 1,
				p = !1;
			const u = [],
				m = {
					originX: 0,
					originY: 0,
					slideEl: void 0,
					slideWidth: void 0,
					slideHeight: void 0,
					imageEl: void 0,
					imageWrapEl: void 0,
					maxRatio: 3,
				},
				h = {
					isTouched: void 0,
					isMoved: void 0,
					currentX: void 0,
					currentY: void 0,
					minX: void 0,
					minY: void 0,
					maxX: void 0,
					maxY: void 0,
					width: void 0,
					height: void 0,
					startX: void 0,
					startY: void 0,
					touchesStart: {},
					touchesCurrent: {},
				},
				g = {
					x: void 0,
					y: void 0,
					prevPositionX: void 0,
					prevPositionY: void 0,
					prevTime: void 0,
				};
			let w = 1;
			function b() {
				if (u.length < 2) return 1;
				const e = u[0].pageX,
					t = u[0].pageY,
					s = u[1].pageX,
					a = u[1].pageY;
				return Math.sqrt((s - e) ** 2 + (a - t) ** 2);
			}
			function E(e) {
				const s = t.isElement
					? "swiper-slide"
					: `.${t.params.slideClass}`;
				return (
					!!e.target.matches(s) ||
					t.slides.filter((t) => t.contains(e.target)).length > 0
				);
			}
			function x(e) {
				if (("mouse" === e.pointerType && u.splice(0, u.length), !E(e)))
					return;
				const s = t.params.zoom;
				if (((l = !1), (d = !1), u.push(e), !(u.length < 2))) {
					if (((l = !0), (m.scaleStart = b()), !m.slideEl)) {
						(m.slideEl = e.target.closest(
							`.${t.params.slideClass}, swiper-slide`
						)),
							m.slideEl || (m.slideEl = t.slides[t.activeIndex]);
						let a = m.slideEl.querySelector(`.${s.containerClass}`);
						if (
							(a &&
								(a = a.querySelectorAll(
									"picture, img, svg, canvas, .swiper-zoom-target"
								)[0]),
							(m.imageEl = a),
							(m.imageWrapEl = a
								? y(m.imageEl, `.${s.containerClass}`)[0]
								: void 0),
							!m.imageWrapEl)
						)
							return void (m.imageEl = void 0);
						m.maxRatio =
							m.imageWrapEl.getAttribute("data-swiper-zoom") ||
							s.maxRatio;
					}
					if (m.imageEl) {
						const [e, t] = (function () {
							if (u.length < 2) return { x: null, y: null };
							const e = m.imageEl.getBoundingClientRect();
							return [
								(u[0].pageX +
									(u[1].pageX - u[0].pageX) / 2 -
									e.x) /
									c,
								(u[0].pageY +
									(u[1].pageY - u[0].pageY) / 2 -
									e.y) /
									c,
							];
						})();
						(m.originX = e),
							(m.originY = t),
							(m.imageEl.style.transitionDuration = "0ms");
					}
					p = !0;
				}
			}
			function S(e) {
				if (!E(e)) return;
				const s = t.params.zoom,
					a = t.zoom,
					i = u.findIndex((t) => t.pointerId === e.pointerId);
				i >= 0 && (u[i] = e),
					u.length < 2 ||
						((d = !0),
						(m.scaleMove = b()),
						m.imageEl &&
							((a.scale = (m.scaleMove / m.scaleStart) * c),
							a.scale > m.maxRatio &&
								(a.scale =
									m.maxRatio -
									1 +
									(a.scale - m.maxRatio + 1) ** 0.5),
							a.scale < s.minRatio &&
								(a.scale =
									s.minRatio +
									1 -
									(s.minRatio - a.scale + 1) ** 0.5),
							(m.imageEl.style.transform = `translate3d(0,0,0) scale(${a.scale})`)));
			}
			function T(e) {
				if (!E(e)) return;
				if ("mouse" === e.pointerType && "pointerout" === e.type)
					return;
				const s = t.params.zoom,
					a = t.zoom,
					i = u.findIndex((t) => t.pointerId === e.pointerId);
				i >= 0 && u.splice(i, 1),
					l &&
						d &&
						((l = !1),
						(d = !1),
						m.imageEl &&
							((a.scale = Math.max(
								Math.min(a.scale, m.maxRatio),
								s.minRatio
							)),
							(m.imageEl.style.transitionDuration = `${t.params.speed}ms`),
							(m.imageEl.style.transform = `translate3d(0,0,0) scale(${a.scale})`),
							(c = a.scale),
							(p = !1),
							a.scale > 1 && m.slideEl
								? m.slideEl.classList.add(
										`${s.zoomedSlideClass}`
								  )
								: a.scale <= 1 &&
								  m.slideEl &&
								  m.slideEl.classList.remove(
										`${s.zoomedSlideClass}`
								  ),
							1 === a.scale &&
								((m.originX = 0),
								(m.originY = 0),
								(m.slideEl = void 0))));
			}
			function M(e) {
				if (
					!E(e) ||
					!(function (e) {
						const s = `.${t.params.zoom.containerClass}`;
						return (
							!!e.target.matches(s) ||
							[...t.el.querySelectorAll(s)].filter((t) =>
								t.contains(e.target)
							).length > 0
						);
					})(e)
				)
					return;
				const s = t.zoom;
				if (!m.imageEl) return;
				if (!h.isTouched || !m.slideEl) return;
				h.isMoved ||
					((h.width = m.imageEl.offsetWidth),
					(h.height = m.imageEl.offsetHeight),
					(h.startX = o(m.imageWrapEl, "x") || 0),
					(h.startY = o(m.imageWrapEl, "y") || 0),
					(m.slideWidth = m.slideEl.offsetWidth),
					(m.slideHeight = m.slideEl.offsetHeight),
					(m.imageWrapEl.style.transitionDuration = "0ms"));
				const a = h.width * s.scale,
					i = h.height * s.scale;
				if (a < m.slideWidth && i < m.slideHeight) return;
				(h.minX = Math.min(m.slideWidth / 2 - a / 2, 0)),
					(h.maxX = -h.minX),
					(h.minY = Math.min(m.slideHeight / 2 - i / 2, 0)),
					(h.maxY = -h.minY),
					(h.touchesCurrent.x = u.length > 0 ? u[0].pageX : e.pageX),
					(h.touchesCurrent.y = u.length > 0 ? u[0].pageY : e.pageY);
				if (
					(Math.max(
						Math.abs(h.touchesCurrent.x - h.touchesStart.x),
						Math.abs(h.touchesCurrent.y - h.touchesStart.y)
					) > 5 && (t.allowClick = !1),
					!h.isMoved && !p)
				) {
					if (
						t.isHorizontal() &&
						((Math.floor(h.minX) === Math.floor(h.startX) &&
							h.touchesCurrent.x < h.touchesStart.x) ||
							(Math.floor(h.maxX) === Math.floor(h.startX) &&
								h.touchesCurrent.x > h.touchesStart.x))
					)
						return void (h.isTouched = !1);
					if (
						!t.isHorizontal() &&
						((Math.floor(h.minY) === Math.floor(h.startY) &&
							h.touchesCurrent.y < h.touchesStart.y) ||
							(Math.floor(h.maxY) === Math.floor(h.startY) &&
								h.touchesCurrent.y > h.touchesStart.y))
					)
						return void (h.isTouched = !1);
				}
				e.cancelable && e.preventDefault(),
					e.stopPropagation(),
					(h.isMoved = !0);
				const r = (s.scale - c) / (m.maxRatio - t.params.zoom.minRatio),
					{ originX: n, originY: l } = m;
				(h.currentX =
					h.touchesCurrent.x -
					h.touchesStart.x +
					h.startX +
					r * (h.width - 2 * n)),
					(h.currentY =
						h.touchesCurrent.y -
						h.touchesStart.y +
						h.startY +
						r * (h.height - 2 * l)),
					h.currentX < h.minX &&
						(h.currentX =
							h.minX + 1 - (h.minX - h.currentX + 1) ** 0.8),
					h.currentX > h.maxX &&
						(h.currentX =
							h.maxX - 1 + (h.currentX - h.maxX + 1) ** 0.8),
					h.currentY < h.minY &&
						(h.currentY =
							h.minY + 1 - (h.minY - h.currentY + 1) ** 0.8),
					h.currentY > h.maxY &&
						(h.currentY =
							h.maxY - 1 + (h.currentY - h.maxY + 1) ** 0.8),
					g.prevPositionX || (g.prevPositionX = h.touchesCurrent.x),
					g.prevPositionY || (g.prevPositionY = h.touchesCurrent.y),
					g.prevTime || (g.prevTime = Date.now()),
					(g.x =
						(h.touchesCurrent.x - g.prevPositionX) /
						(Date.now() - g.prevTime) /
						2),
					(g.y =
						(h.touchesCurrent.y - g.prevPositionY) /
						(Date.now() - g.prevTime) /
						2),
					Math.abs(h.touchesCurrent.x - g.prevPositionX) < 2 &&
						(g.x = 0),
					Math.abs(h.touchesCurrent.y - g.prevPositionY) < 2 &&
						(g.y = 0),
					(g.prevPositionX = h.touchesCurrent.x),
					(g.prevPositionY = h.touchesCurrent.y),
					(g.prevTime = Date.now()),
					(m.imageWrapEl.style.transform = `translate3d(${h.currentX}px, ${h.currentY}px,0)`);
			}
			function C() {
				const e = t.zoom;
				m.slideEl &&
					t.activeIndex !== t.slides.indexOf(m.slideEl) &&
					(m.imageEl &&
						(m.imageEl.style.transform =
							"translate3d(0,0,0) scale(1)"),
					m.imageWrapEl &&
						(m.imageWrapEl.style.transform = "translate3d(0,0,0)"),
					m.slideEl.classList.remove(
						`${t.params.zoom.zoomedSlideClass}`
					),
					(e.scale = 1),
					(c = 1),
					(m.slideEl = void 0),
					(m.imageEl = void 0),
					(m.imageWrapEl = void 0),
					(m.originX = 0),
					(m.originY = 0));
			}
			function P(e) {
				const s = t.zoom,
					a = t.params.zoom;
				if (!m.slideEl) {
					e &&
						e.target &&
						(m.slideEl = e.target.closest(
							`.${t.params.slideClass}, swiper-slide`
						)),
						m.slideEl ||
							(t.params.virtual &&
							t.params.virtual.enabled &&
							t.virtual
								? (m.slideEl = f(
										t.slidesEl,
										`.${t.params.slideActiveClass}`
								  )[0])
								: (m.slideEl = t.slides[t.activeIndex]));
					let s = m.slideEl.querySelector(`.${a.containerClass}`);
					s &&
						(s = s.querySelectorAll(
							"picture, img, svg, canvas, .swiper-zoom-target"
						)[0]),
						(m.imageEl = s),
						(m.imageWrapEl = s
							? y(m.imageEl, `.${a.containerClass}`)[0]
							: void 0);
				}
				if (!m.imageEl || !m.imageWrapEl) return;
				let i, r, l, o, d, p, u, g, w, b, E, x, S, T, M, C, P, L;
				t.params.cssMode &&
					((t.wrapperEl.style.overflow = "hidden"),
					(t.wrapperEl.style.touchAction = "none")),
					m.slideEl.classList.add(`${a.zoomedSlideClass}`),
					void 0 === h.touchesStart.x && e
						? ((i = e.pageX), (r = e.pageY))
						: ((i = h.touchesStart.x), (r = h.touchesStart.y));
				const z = "number" == typeof e ? e : null;
				1 === c && z && ((i = void 0), (r = void 0)),
					(s.scale =
						z ||
						m.imageWrapEl.getAttribute("data-swiper-zoom") ||
						a.maxRatio),
					(c =
						z ||
						m.imageWrapEl.getAttribute("data-swiper-zoom") ||
						a.maxRatio),
					!e || (1 === c && z)
						? ((u = 0), (g = 0))
						: ((P = m.slideEl.offsetWidth),
						  (L = m.slideEl.offsetHeight),
						  (l = v(m.slideEl).left + n.scrollX),
						  (o = v(m.slideEl).top + n.scrollY),
						  (d = l + P / 2 - i),
						  (p = o + L / 2 - r),
						  (w = m.imageEl.offsetWidth),
						  (b = m.imageEl.offsetHeight),
						  (E = w * s.scale),
						  (x = b * s.scale),
						  (S = Math.min(P / 2 - E / 2, 0)),
						  (T = Math.min(L / 2 - x / 2, 0)),
						  (M = -S),
						  (C = -T),
						  (u = d * s.scale),
						  (g = p * s.scale),
						  u < S && (u = S),
						  u > M && (u = M),
						  g < T && (g = T),
						  g > C && (g = C)),
					z && 1 === s.scale && ((m.originX = 0), (m.originY = 0)),
					(m.imageWrapEl.style.transitionDuration = "300ms"),
					(m.imageWrapEl.style.transform = `translate3d(${u}px, ${g}px,0)`),
					(m.imageEl.style.transitionDuration = "300ms"),
					(m.imageEl.style.transform = `translate3d(0,0,0) scale(${s.scale})`);
			}
			function L() {
				const e = t.zoom,
					s = t.params.zoom;
				if (!m.slideEl) {
					t.params.virtual && t.params.virtual.enabled && t.virtual
						? (m.slideEl = f(
								t.slidesEl,
								`.${t.params.slideActiveClass}`
						  )[0])
						: (m.slideEl = t.slides[t.activeIndex]);
					let e = m.slideEl.querySelector(`.${s.containerClass}`);
					e &&
						(e = e.querySelectorAll(
							"picture, img, svg, canvas, .swiper-zoom-target"
						)[0]),
						(m.imageEl = e),
						(m.imageWrapEl = e
							? y(m.imageEl, `.${s.containerClass}`)[0]
							: void 0);
				}
				m.imageEl &&
					m.imageWrapEl &&
					(t.params.cssMode &&
						((t.wrapperEl.style.overflow = ""),
						(t.wrapperEl.style.touchAction = "")),
					(e.scale = 1),
					(c = 1),
					(m.imageWrapEl.style.transitionDuration = "300ms"),
					(m.imageWrapEl.style.transform = "translate3d(0,0,0)"),
					(m.imageEl.style.transitionDuration = "300ms"),
					(m.imageEl.style.transform = "translate3d(0,0,0) scale(1)"),
					m.slideEl.classList.remove(`${s.zoomedSlideClass}`),
					(m.slideEl = void 0),
					(m.originX = 0),
					(m.originY = 0));
			}
			function z(e) {
				const s = t.zoom;
				s.scale && 1 !== s.scale ? L() : P(e);
			}
			function A() {
				return {
					passiveListener: !!t.params.passiveListeners && {
						passive: !0,
						capture: !1,
					},
					activeListenerWithCapture: !t.params.passiveListeners || {
						passive: !1,
						capture: !0,
					},
				};
			}
			function $() {
				const e = t.zoom;
				if (e.enabled) return;
				e.enabled = !0;
				const { passiveListener: s, activeListenerWithCapture: a } =
					A();
				t.wrapperEl.addEventListener("pointerdown", x, s),
					t.wrapperEl.addEventListener("pointermove", S, a),
					["pointerup", "pointercancel", "pointerout"].forEach(
						(e) => {
							t.wrapperEl.addEventListener(e, T, s);
						}
					),
					t.wrapperEl.addEventListener("pointermove", M, a);
			}
			function I() {
				const e = t.zoom;
				if (!e.enabled) return;
				e.enabled = !1;
				const { passiveListener: s, activeListenerWithCapture: a } =
					A();
				t.wrapperEl.removeEventListener("pointerdown", x, s),
					t.wrapperEl.removeEventListener("pointermove", S, a),
					["pointerup", "pointercancel", "pointerout"].forEach(
						(e) => {
							t.wrapperEl.removeEventListener(e, T, s);
						}
					),
					t.wrapperEl.removeEventListener("pointermove", M, a);
			}
			Object.defineProperty(t.zoom, "scale", {
				get: () => w,
				set(e) {
					if (w !== e) {
						const t = m.imageEl,
							s = m.slideEl;
						i("zoomChange", e, t, s);
					}
					w = e;
				},
			}),
				a("init", () => {
					t.params.zoom.enabled && $();
				}),
				a("destroy", () => {
					I();
				}),
				a("touchStart", (e, s) => {
					t.zoom.enabled &&
						(function (e) {
							const s = t.device;
							if (!m.imageEl) return;
							if (h.isTouched) return;
							s.android && e.cancelable && e.preventDefault(),
								(h.isTouched = !0);
							const a = u.length > 0 ? u[0] : e;
							(h.touchesStart.x = a.pageX),
								(h.touchesStart.y = a.pageY);
						})(s);
				}),
				a("touchEnd", (e, s) => {
					t.zoom.enabled &&
						(function () {
							const e = t.zoom;
							if (!m.imageEl) return;
							if (!h.isTouched || !h.isMoved)
								return (
									(h.isTouched = !1), void (h.isMoved = !1)
								);
							(h.isTouched = !1), (h.isMoved = !1);
							let s = 300,
								a = 300;
							const i = g.x * s,
								r = h.currentX + i,
								n = g.y * a,
								l = h.currentY + n;
							0 !== g.x && (s = Math.abs((r - h.currentX) / g.x)),
								0 !== g.y &&
									(a = Math.abs((l - h.currentY) / g.y));
							const o = Math.max(s, a);
							(h.currentX = r), (h.currentY = l);
							const d = h.width * e.scale,
								c = h.height * e.scale;
							(h.minX = Math.min(m.slideWidth / 2 - d / 2, 0)),
								(h.maxX = -h.minX),
								(h.minY = Math.min(
									m.slideHeight / 2 - c / 2,
									0
								)),
								(h.maxY = -h.minY),
								(h.currentX = Math.max(
									Math.min(h.currentX, h.maxX),
									h.minX
								)),
								(h.currentY = Math.max(
									Math.min(h.currentY, h.maxY),
									h.minY
								)),
								(m.imageWrapEl.style.transitionDuration = `${o}ms`),
								(m.imageWrapEl.style.transform = `translate3d(${h.currentX}px, ${h.currentY}px,0)`);
						})();
				}),
				a("doubleTap", (e, s) => {
					!t.animating &&
						t.params.zoom.enabled &&
						t.zoom.enabled &&
						t.params.zoom.toggle &&
						z(s);
				}),
				a("transitionEnd", () => {
					t.zoom.enabled && t.params.zoom.enabled && C();
				}),
				a("slideChange", () => {
					t.zoom.enabled &&
						t.params.zoom.enabled &&
						t.params.cssMode &&
						C();
				}),
				Object.assign(t.zoom, {
					enable: $,
					disable: I,
					in: P,
					out: L,
					toggle: z,
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			function i(e, t) {
				const s = (function () {
					let e, t, s;
					return (a, i) => {
						for (t = -1, e = a.length; e - t > 1; )
							(s = (e + t) >> 1), a[s] <= i ? (t = s) : (e = s);
						return e;
					};
				})();
				let a, i;
				return (
					(this.x = e),
					(this.y = t),
					(this.lastIndex = e.length - 1),
					(this.interpolate = function (e) {
						return e
							? ((i = s(this.x, e)),
							  (a = i - 1),
							  ((e - this.x[a]) * (this.y[i] - this.y[a])) /
									(this.x[i] - this.x[a]) +
									this.y[a])
							: 0;
					}),
					this
				);
			}
			function r() {
				t.controller.control &&
					t.controller.spline &&
					((t.controller.spline = void 0),
					delete t.controller.spline);
			}
			s({ controller: { control: void 0, inverse: !1, by: "slide" } }),
				(t.controller = { control: void 0 }),
				a("beforeInit", () => {
					if (
						"undefined" != typeof window &&
						("string" == typeof t.params.controller.control ||
							t.params.controller.control instanceof HTMLElement)
					) {
						const e = document.querySelector(
							t.params.controller.control
						);
						if (e && e.swiper) t.controller.control = e.swiper;
						else if (e) {
							const s = (a) => {
								(t.controller.control = a.detail[0]),
									t.update(),
									e.removeEventListener("init", s);
							};
							e.addEventListener("init", s);
						}
					} else t.controller.control = t.params.controller.control;
				}),
				a("update", () => {
					r();
				}),
				a("resize", () => {
					r();
				}),
				a("observerUpdate", () => {
					r();
				}),
				a("setTranslate", (e, s, a) => {
					t.controller.control &&
						!t.controller.control.destroyed &&
						t.controller.setTranslate(s, a);
				}),
				a("setTransition", (e, s, a) => {
					t.controller.control &&
						!t.controller.control.destroyed &&
						t.controller.setTransition(s, a);
				}),
				Object.assign(t.controller, {
					setTranslate: function (e, s) {
						const a = t.controller.control;
						let r, n;
						const l = t.constructor;
						function o(e) {
							if (e.destroyed) return;
							const s = t.rtlTranslate
								? -t.translate
								: t.translate;
							"slide" === t.params.controller.by &&
								(!(function (e) {
									t.controller.spline = t.params.loop
										? new i(t.slidesGrid, e.slidesGrid)
										: new i(t.snapGrid, e.snapGrid);
								})(e),
								(n = -t.controller.spline.interpolate(-s))),
								(n && "container" !== t.params.controller.by) ||
									((r =
										(e.maxTranslate() - e.minTranslate()) /
										(t.maxTranslate() - t.minTranslate())),
									(!Number.isNaN(r) && Number.isFinite(r)) ||
										(r = 1),
									(n =
										(s - t.minTranslate()) * r +
										e.minTranslate())),
								t.params.controller.inverse &&
									(n = e.maxTranslate() - n),
								e.updateProgress(n),
								e.setTranslate(n, t),
								e.updateActiveIndex(),
								e.updateSlidesClasses();
						}
						if (Array.isArray(a))
							for (let e = 0; e < a.length; e += 1)
								a[e] !== s && a[e] instanceof l && o(a[e]);
						else a instanceof l && s !== a && o(a);
					},
					setTransition: function (e, s) {
						const a = t.constructor,
							i = t.controller.control;
						let r;
						function l(s) {
							s.destroyed ||
								(s.setTransition(e, t),
								0 !== e &&
									(s.transitionStart(),
									s.params.autoHeight &&
										n(() => {
											s.updateAutoHeight();
										}),
									E(s.wrapperEl, () => {
										i && s.transitionEnd();
									})));
						}
						if (Array.isArray(i))
							for (r = 0; r < i.length; r += 1)
								i[r] !== s && i[r] instanceof a && l(i[r]);
						else i instanceof a && s !== i && l(i);
					},
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				a11y: {
					enabled: !0,
					notificationClass: "swiper-notification",
					prevSlideMessage: "Previous slide",
					nextSlideMessage: "Next slide",
					firstSlideMessage: "This is the first slide",
					lastSlideMessage: "This is the last slide",
					paginationBulletMessage: "Go to slide {{index}}",
					slideLabelMessage: "{{index}} / {{slidesLength}}",
					containerMessage: null,
					containerRoleDescriptionMessage: null,
					itemRoleDescriptionMessage: null,
					slideRole: "group",
					id: null,
				},
			}),
				(t.a11y = { clicked: !1 });
			let i = null;
			function r(e) {
				const t = i;
				0 !== t.length && ((t.innerHTML = ""), (t.innerHTML = e));
			}
			const n = (e) => (
				Array.isArray(e) || (e = [e].filter((e) => !!e)), e
			);
			function l(e) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("tabIndex", "0");
				});
			}
			function o(e) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("tabIndex", "-1");
				});
			}
			function d(e, t) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("role", t);
				});
			}
			function c(e, t) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("aria-roledescription", t);
				});
			}
			function p(e, t) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("aria-label", t);
				});
			}
			function u(e) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("aria-disabled", !0);
				});
			}
			function m(e) {
				(e = n(e)).forEach((e) => {
					e.setAttribute("aria-disabled", !1);
				});
			}
			function h(e) {
				if (13 !== e.keyCode && 32 !== e.keyCode) return;
				const s = t.params.a11y,
					a = e.target;
				(t.pagination &&
					t.pagination.el &&
					(a === t.pagination.el ||
						t.pagination.el.contains(e.target)) &&
					!e.target.matches(te(t.params.pagination.bulletClass))) ||
					(t.navigation &&
						t.navigation.nextEl &&
						a === t.navigation.nextEl &&
						((t.isEnd && !t.params.loop) || t.slideNext(),
						t.isEnd
							? r(s.lastSlideMessage)
							: r(s.nextSlideMessage)),
					t.navigation &&
						t.navigation.prevEl &&
						a === t.navigation.prevEl &&
						((t.isBeginning && !t.params.loop) || t.slidePrev(),
						t.isBeginning
							? r(s.firstSlideMessage)
							: r(s.prevSlideMessage)),
					t.pagination &&
						a.matches(te(t.params.pagination.bulletClass)) &&
						a.click());
			}
			function f() {
				return (
					t.pagination &&
					t.pagination.bullets &&
					t.pagination.bullets.length
				);
			}
			function v() {
				return f() && t.params.pagination.clickable;
			}
			const w = (e, t, s) => {
					l(e),
						"BUTTON" !== e.tagName &&
							(d(e, "button"), e.addEventListener("keydown", h)),
						p(e, s),
						(function (e, t) {
							(e = n(e)).forEach((e) => {
								e.setAttribute("aria-controls", t);
							});
						})(e, t);
				},
				y = () => {
					t.a11y.clicked = !0;
				},
				E = () => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							t.destroyed || (t.a11y.clicked = !1);
						});
					});
				},
				x = (e) => {
					if (t.a11y.clicked) return;
					const s = e.target.closest(
						`.${t.params.slideClass}, swiper-slide`
					);
					if (!s || !t.slides.includes(s)) return;
					const a = t.slides.indexOf(s) === t.activeIndex,
						i =
							t.params.watchSlidesProgress &&
							t.visibleSlides &&
							t.visibleSlides.includes(s);
					a ||
						i ||
						(e.sourceCapabilities &&
							e.sourceCapabilities.firesTouchEvents) ||
						(t.isHorizontal()
							? (t.el.scrollLeft = 0)
							: (t.el.scrollTop = 0),
						t.slideTo(t.slides.indexOf(s), 0));
				},
				S = () => {
					const e = t.params.a11y;
					e.itemRoleDescriptionMessage &&
						c(t.slides, e.itemRoleDescriptionMessage),
						e.slideRole && d(t.slides, e.slideRole);
					const s = t.slides.length;
					e.slideLabelMessage &&
						t.slides.forEach((a, i) => {
							const r = t.params.loop
								? parseInt(
										a.getAttribute(
											"data-swiper-slide-index"
										),
										10
								  )
								: i;
							p(
								a,
								e.slideLabelMessage
									.replace(/\{\{index\}\}/, r + 1)
									.replace(/\{\{slidesLength\}\}/, s)
							);
						});
				},
				T = () => {
					const e = t.params.a11y;
					t.isElement ? t.el.shadowEl.append(i) : t.el.append(i);
					const s = t.el;
					e.containerRoleDescriptionMessage &&
						c(s, e.containerRoleDescriptionMessage),
						e.containerMessage && p(s, e.containerMessage);
					const a = t.wrapperEl,
						r =
							e.id ||
							a.getAttribute("id") ||
							`swiper-wrapper-${
								((l = 16),
								void 0 === l && (l = 16),
								"x"
									.repeat(l)
									.replace(/x/g, () =>
										Math.round(16 * Math.random()).toString(
											16
										)
									))
							}`;
					var l;
					const o =
						t.params.autoplay && t.params.autoplay.enabled
							? "off"
							: "polite";
					var d;
					(d = r),
						n(a).forEach((e) => {
							e.setAttribute("id", d);
						}),
						(function (e, t) {
							(e = n(e)).forEach((e) => {
								e.setAttribute("aria-live", t);
							});
						})(a, o),
						S();
					let { nextEl: u, prevEl: m } = t.navigation
						? t.navigation
						: {};
					if (
						((u = n(u)),
						(m = n(m)),
						u && u.forEach((t) => w(t, r, e.nextSlideMessage)),
						m && m.forEach((t) => w(t, r, e.prevSlideMessage)),
						v())
					) {
						(Array.isArray(t.pagination.el)
							? t.pagination.el
							: [t.pagination.el]
						).forEach((e) => {
							e.addEventListener("keydown", h);
						});
					}
					t.el.addEventListener("focus", x, !0),
						t.el.addEventListener("pointerdown", y, !0),
						t.el.addEventListener("pointerup", E, !0);
				};
			a("beforeInit", () => {
				(i = g("span", t.params.a11y.notificationClass)),
					i.setAttribute("aria-live", "assertive"),
					i.setAttribute("aria-atomic", "true");
			}),
				a("afterInit", () => {
					t.params.a11y.enabled && T();
				}),
				a(
					"slidesLengthChange snapGridLengthChange slidesGridLengthChange",
					() => {
						t.params.a11y.enabled && S();
					}
				),
				a("fromEdge toEdge afterInit lock unlock", () => {
					t.params.a11y.enabled &&
						(function () {
							if (
								t.params.loop ||
								t.params.rewind ||
								!t.navigation
							)
								return;
							const { nextEl: e, prevEl: s } = t.navigation;
							s && (t.isBeginning ? (u(s), o(s)) : (m(s), l(s))),
								e && (t.isEnd ? (u(e), o(e)) : (m(e), l(e)));
						})();
				}),
				a("paginationUpdate", () => {
					t.params.a11y.enabled &&
						(function () {
							const e = t.params.a11y;
							f() &&
								t.pagination.bullets.forEach((s) => {
									t.params.pagination.clickable &&
										(l(s),
										t.params.pagination.renderBullet ||
											(d(s, "button"),
											p(
												s,
												e.paginationBulletMessage.replace(
													/\{\{index\}\}/,
													b(s) + 1
												)
											))),
										s.matches(
											te(
												t.params.pagination
													.bulletActiveClass
											)
										)
											? s.setAttribute(
													"aria-current",
													"true"
											  )
											: s.removeAttribute("aria-current");
								});
						})();
				}),
				a("destroy", () => {
					t.params.a11y.enabled &&
						(function () {
							i && i.remove();
							let { nextEl: e, prevEl: s } = t.navigation
								? t.navigation
								: {};
							(e = n(e)),
								(s = n(s)),
								e &&
									e.forEach((e) =>
										e.removeEventListener("keydown", h)
									),
								s &&
									s.forEach((e) =>
										e.removeEventListener("keydown", h)
									),
								v() &&
									(Array.isArray(t.pagination.el)
										? t.pagination.el
										: [t.pagination.el]
									).forEach((e) => {
										e.removeEventListener("keydown", h);
									});
							t.el.removeEventListener("focus", x, !0),
								t.el.removeEventListener("pointerdown", y, !0),
								t.el.removeEventListener("pointerup", E, !0);
						})();
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				history: {
					enabled: !1,
					root: "",
					replaceState: !1,
					key: "slides",
					keepQuery: !1,
				},
			});
			let i = !1,
				n = {};
			const l = (e) =>
					e
						.toString()
						.replace(/\s+/g, "-")
						.replace(/[^\w-]+/g, "")
						.replace(/--+/g, "-")
						.replace(/^-+/, "")
						.replace(/-+$/, ""),
				o = (e) => {
					const t = r();
					let s;
					s = e ? new URL(e) : t.location;
					const a = s.pathname
							.slice(1)
							.split("/")
							.filter((e) => "" !== e),
						i = a.length;
					return { key: a[i - 2], value: a[i - 1] };
				},
				d = (e, s) => {
					const a = r();
					if (!i || !t.params.history.enabled) return;
					let n;
					n = t.params.url ? new URL(t.params.url) : a.location;
					const o = t.slides[s];
					let d = l(o.getAttribute("data-history"));
					if (t.params.history.root.length > 0) {
						let s = t.params.history.root;
						"/" === s[s.length - 1] &&
							(s = s.slice(0, s.length - 1)),
							(d = `${s}/${e ? `${e}/` : ""}${d}`);
					} else
						n.pathname.includes(e) ||
							(d = `${e ? `${e}/` : ""}${d}`);
					t.params.history.keepQuery && (d += n.search);
					const c = a.history.state;
					(c && c.value === d) ||
						(t.params.history.replaceState
							? a.history.replaceState({ value: d }, null, d)
							: a.history.pushState({ value: d }, null, d));
				},
				c = (e, s, a) => {
					if (s)
						for (let i = 0, r = t.slides.length; i < r; i += 1) {
							const r = t.slides[i];
							if (l(r.getAttribute("data-history")) === s) {
								const s = t.getSlideIndex(r);
								t.slideTo(s, e, a);
							}
						}
					else t.slideTo(0, e, a);
				},
				p = () => {
					(n = o(t.params.url)), c(t.params.speed, n.value, !1);
				};
			a("init", () => {
				t.params.history.enabled &&
					(() => {
						const e = r();
						if (t.params.history) {
							if (!e.history || !e.history.pushState)
								return (
									(t.params.history.enabled = !1),
									void (t.params.hashNavigation.enabled = !0)
								);
							(i = !0),
								(n = o(t.params.url)),
								n.key || n.value
									? (c(
											0,
											n.value,
											t.params.runCallbacksOnInit
									  ),
									  t.params.history.replaceState ||
											e.addEventListener("popstate", p))
									: t.params.history.replaceState ||
									  e.addEventListener("popstate", p);
						}
					})();
			}),
				a("destroy", () => {
					t.params.history.enabled &&
						(() => {
							const e = r();
							t.params.history.replaceState ||
								e.removeEventListener("popstate", p);
						})();
				}),
				a("transitionEnd _freeModeNoMomentumRelease", () => {
					i && d(t.params.history.key, t.activeIndex);
				}),
				a("slideChange", () => {
					i &&
						t.params.cssMode &&
						d(t.params.history.key, t.activeIndex);
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, emit: i, on: n } = e,
				l = !1;
			const o = a(),
				d = r();
			s({
				hashNavigation: {
					enabled: !1,
					replaceState: !1,
					watchState: !1,
					getSlideIndex(e, s) {
						if (t.virtual && t.params.virtual.enabled) {
							const e = t.slides.filter(
								(e) => e.getAttribute("data-hash") === s
							)[0];
							if (!e) return 0;
							return parseInt(
								e.getAttribute("data-swiper-slide-index"),
								10
							);
						}
						return t.getSlideIndex(
							f(
								t.slidesEl,
								`.${t.params.slideClass}[data-hash="${s}"], swiper-slide[data-hash="${s}"]`
							)[0]
						);
					},
				},
			});
			const c = () => {
					i("hashChange");
					const e = o.location.hash.replace("#", ""),
						s =
							t.virtual && t.params.virtual.enabled
								? t.slidesEl.querySelector(
										`[data-swiper-slide-index="${t.activeIndex}"]`
								  )
								: t.slides[t.activeIndex];
					if (e !== (s ? s.getAttribute("data-hash") : "")) {
						const s = t.params.hashNavigation.getSlideIndex(t, e);
						if (void 0 === s || Number.isNaN(s)) return;
						t.slideTo(s);
					}
				},
				p = () => {
					if (!l || !t.params.hashNavigation.enabled) return;
					const e =
							t.virtual && t.params.virtual.enabled
								? t.slidesEl.querySelector(
										`[data-swiper-slide-index="${t.activeIndex}"]`
								  )
								: t.slides[t.activeIndex],
						s = e
							? e.getAttribute("data-hash") ||
							  e.getAttribute("data-history")
							: "";
					t.params.hashNavigation.replaceState &&
					d.history &&
					d.history.replaceState
						? (d.history.replaceState(null, null, `#${s}` || ""),
						  i("hashSet"))
						: ((o.location.hash = s || ""), i("hashSet"));
				};
			n("init", () => {
				t.params.hashNavigation.enabled &&
					(() => {
						if (
							!t.params.hashNavigation.enabled ||
							(t.params.history && t.params.history.enabled)
						)
							return;
						l = !0;
						const e = o.location.hash.replace("#", "");
						if (e) {
							const s = 0,
								a = t.params.hashNavigation.getSlideIndex(t, e);
							t.slideTo(
								a || 0,
								s,
								t.params.runCallbacksOnInit,
								!0
							);
						}
						t.params.hashNavigation.watchState &&
							d.addEventListener("hashchange", c);
					})();
			}),
				n("destroy", () => {
					t.params.hashNavigation.enabled &&
						t.params.hashNavigation.watchState &&
						d.removeEventListener("hashchange", c);
				}),
				n("transitionEnd _freeModeNoMomentumRelease", () => {
					l && p();
				}),
				n("slideChange", () => {
					l && t.params.cssMode && p();
				});
		},
		function (e) {
			let t,
				s,
				{ swiper: i, extendParams: r, on: n, emit: l, params: o } = e;
			(i.autoplay = { running: !1, paused: !1, timeLeft: 0 }),
				r({
					autoplay: {
						enabled: !1,
						delay: 3e3,
						waitForTransition: !0,
						disableOnInteraction: !0,
						stopOnLastSlide: !1,
						reverseDirection: !1,
						pauseOnMouseEnter: !1,
					},
				});
			let d,
				c,
				p,
				u,
				m,
				h,
				f,
				g = o && o.autoplay ? o.autoplay.delay : 3e3,
				v = o && o.autoplay ? o.autoplay.delay : 3e3,
				w = new Date().getTime;
			function b(e) {
				i &&
					!i.destroyed &&
					i.wrapperEl &&
					e.target === i.wrapperEl &&
					(i.wrapperEl.removeEventListener("transitionend", b), M());
			}
			const y = () => {
					if (i.destroyed || !i.autoplay.running) return;
					i.autoplay.paused ? (c = !0) : c && ((v = d), (c = !1));
					const e = i.autoplay.paused
						? d
						: w + v - new Date().getTime();
					(i.autoplay.timeLeft = e),
						l("autoplayTimeLeft", e, e / g),
						(s = requestAnimationFrame(() => {
							y();
						}));
				},
				E = (e) => {
					if (i.destroyed || !i.autoplay.running) return;
					cancelAnimationFrame(s), y();
					let a = void 0 === e ? i.params.autoplay.delay : e;
					(g = i.params.autoplay.delay),
						(v = i.params.autoplay.delay);
					const r = (() => {
						let e;
						if (
							((e =
								i.virtual && i.params.virtual.enabled
									? i.slides.filter((e) =>
											e.classList.contains(
												"swiper-slide-active"
											)
									  )[0]
									: i.slides[i.activeIndex]),
							!e)
						)
							return;
						return parseInt(
							e.getAttribute("data-swiper-autoplay"),
							10
						);
					})();
					!Number.isNaN(r) &&
						r > 0 &&
						void 0 === e &&
						((a = r), (g = r), (v = r)),
						(d = a);
					const n = i.params.speed,
						o = () => {
							i &&
								!i.destroyed &&
								(i.params.autoplay.reverseDirection
									? !i.isBeginning ||
									  i.params.loop ||
									  i.params.rewind
										? (i.slidePrev(n, !0, !0),
										  l("autoplay"))
										: i.params.autoplay.stopOnLastSlide ||
										  (i.slideTo(
												i.slides.length - 1,
												n,
												!0,
												!0
										  ),
										  l("autoplay"))
									: !i.isEnd ||
									  i.params.loop ||
									  i.params.rewind
									? (i.slideNext(n, !0, !0), l("autoplay"))
									: i.params.autoplay.stopOnLastSlide ||
									  (i.slideTo(0, n, !0, !0), l("autoplay")),
								i.params.cssMode &&
									((w = new Date().getTime()),
									requestAnimationFrame(() => {
										E();
									})));
						};
					return (
						a > 0
							? (clearTimeout(t),
							  (t = setTimeout(() => {
									o();
							  }, a)))
							: requestAnimationFrame(() => {
									o();
							  }),
						a
					);
				},
				x = () => {
					(i.autoplay.running = !0), E(), l("autoplayStart");
				},
				S = () => {
					(i.autoplay.running = !1),
						clearTimeout(t),
						cancelAnimationFrame(s),
						l("autoplayStop");
				},
				T = (e, s) => {
					if (i.destroyed || !i.autoplay.running) return;
					clearTimeout(t), e || (f = !0);
					const a = () => {
						l("autoplayPause"),
							i.params.autoplay.waitForTransition
								? i.wrapperEl.addEventListener(
										"transitionend",
										b
								  )
								: M();
					};
					if (((i.autoplay.paused = !0), s))
						return (
							h && (d = i.params.autoplay.delay),
							(h = !1),
							void a()
						);
					const r = d || i.params.autoplay.delay;
					(d = r - (new Date().getTime() - w)),
						(i.isEnd && d < 0 && !i.params.loop) ||
							(d < 0 && (d = 0), a());
				},
				M = () => {
					(i.isEnd && d < 0 && !i.params.loop) ||
						i.destroyed ||
						!i.autoplay.running ||
						((w = new Date().getTime()),
						f ? ((f = !1), E(d)) : E(),
						(i.autoplay.paused = !1),
						l("autoplayResume"));
				},
				C = () => {
					if (i.destroyed || !i.autoplay.running) return;
					const e = a();
					"hidden" === e.visibilityState && ((f = !0), T(!0)),
						"visible" === e.visibilityState && M();
				},
				P = (e) => {
					"mouse" === e.pointerType && ((f = !0), T(!0));
				},
				L = (e) => {
					"mouse" === e.pointerType && i.autoplay.paused && M();
				};
			n("init", () => {
				i.params.autoplay.enabled &&
					(i.params.autoplay.pauseOnMouseEnter &&
						(i.el.addEventListener("pointerenter", P),
						i.el.addEventListener("pointerleave", L)),
					a().addEventListener("visibilitychange", C),
					(w = new Date().getTime()),
					x());
			}),
				n("destroy", () => {
					i.el.removeEventListener("pointerenter", P),
						i.el.removeEventListener("pointerleave", L),
						a().removeEventListener("visibilitychange", C),
						i.autoplay.running && S();
				}),
				n("beforeTransitionStart", (e, t, s) => {
					!i.destroyed &&
						i.autoplay.running &&
						(s || !i.params.autoplay.disableOnInteraction
							? T(!0, !0)
							: S());
				}),
				n("sliderFirstMove", () => {
					!i.destroyed &&
						i.autoplay.running &&
						(i.params.autoplay.disableOnInteraction
							? S()
							: ((p = !0),
							  (u = !1),
							  (f = !1),
							  (m = setTimeout(() => {
									(f = !0), (u = !0), T(!0);
							  }, 200))));
				}),
				n("touchEnd", () => {
					if (!i.destroyed && i.autoplay.running && p) {
						if (
							(clearTimeout(m),
							clearTimeout(t),
							i.params.autoplay.disableOnInteraction)
						)
							return (u = !1), void (p = !1);
						u && i.params.cssMode && M(), (u = !1), (p = !1);
					}
				}),
				n("slideChange", () => {
					!i.destroyed && i.autoplay.running && (h = !0);
				}),
				Object.assign(i.autoplay, {
					start: x,
					stop: S,
					pause: T,
					resume: M,
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: i } = e;
			s({
				thumbs: {
					swiper: null,
					multipleActiveThumbs: !0,
					autoScrollOffset: 0,
					slideThumbActiveClass: "swiper-slide-thumb-active",
					thumbsContainerClass: "swiper-thumbs",
				},
			});
			let r = !1,
				n = !1;
			function l() {
				const e = t.thumbs.swiper;
				if (!e || e.destroyed) return;
				const s = e.clickedIndex,
					a = e.clickedSlide;
				if (
					a &&
					a.classList.contains(t.params.thumbs.slideThumbActiveClass)
				)
					return;
				if (null == s) return;
				let i;
				(i = e.params.loop
					? parseInt(
							e.clickedSlide.getAttribute(
								"data-swiper-slide-index"
							),
							10
					  )
					: s),
					t.params.loop ? t.slideToLoop(i) : t.slideTo(i);
			}
			function o() {
				const { thumbs: e } = t.params;
				if (r) return !1;
				r = !0;
				const s = t.constructor;
				if (e.swiper instanceof s)
					(t.thumbs.swiper = e.swiper),
						Object.assign(t.thumbs.swiper.originalParams, {
							watchSlidesProgress: !0,
							slideToClickedSlide: !1,
						}),
						Object.assign(t.thumbs.swiper.params, {
							watchSlidesProgress: !0,
							slideToClickedSlide: !1,
						}),
						t.thumbs.swiper.update();
				else if (d(e.swiper)) {
					const a = Object.assign({}, e.swiper);
					Object.assign(a, {
						watchSlidesProgress: !0,
						slideToClickedSlide: !1,
					}),
						(t.thumbs.swiper = new s(a)),
						(n = !0);
				}
				return (
					t.thumbs.swiper.el.classList.add(
						t.params.thumbs.thumbsContainerClass
					),
					t.thumbs.swiper.on("tap", l),
					!0
				);
			}
			function c(e) {
				const s = t.thumbs.swiper;
				if (!s || s.destroyed) return;
				const a =
					"auto" === s.params.slidesPerView
						? s.slidesPerViewDynamic()
						: s.params.slidesPerView;
				let i = 1;
				const r = t.params.thumbs.slideThumbActiveClass;
				if (
					(t.params.slidesPerView > 1 &&
						!t.params.centeredSlides &&
						(i = t.params.slidesPerView),
					t.params.thumbs.multipleActiveThumbs || (i = 1),
					(i = Math.floor(i)),
					s.slides.forEach((e) => e.classList.remove(r)),
					s.params.loop ||
						(s.params.virtual && s.params.virtual.enabled))
				)
					for (let e = 0; e < i; e += 1)
						f(
							s.slidesEl,
							`[data-swiper-slide-index="${t.realIndex + e}"]`
						).forEach((e) => {
							e.classList.add(r);
						});
				else
					for (let e = 0; e < i; e += 1)
						s.slides[t.realIndex + e] &&
							s.slides[t.realIndex + e].classList.add(r);
				const n = t.params.thumbs.autoScrollOffset,
					l = n && !s.params.loop;
				if (t.realIndex !== s.realIndex || l) {
					const i = s.activeIndex;
					let r, o;
					if (s.params.loop) {
						const e = s.slides.filter(
							(e) =>
								e.getAttribute("data-swiper-slide-index") ===
								`${t.realIndex}`
						)[0];
						(r = s.slides.indexOf(e)),
							(o =
								t.activeIndex > t.previousIndex
									? "next"
									: "prev");
					} else
						(r = t.realIndex),
							(o = r > t.previousIndex ? "next" : "prev");
					l && (r += "next" === o ? n : -1 * n),
						s.visibleSlidesIndexes &&
							s.visibleSlidesIndexes.indexOf(r) < 0 &&
							(s.params.centeredSlides
								? (r =
										r > i
											? r - Math.floor(a / 2) + 1
											: r + Math.floor(a / 2) - 1)
								: r > i && s.params.slidesPerGroup,
							s.slideTo(r, e ? 0 : void 0));
				}
			}
			(t.thumbs = { swiper: null }),
				i("beforeInit", () => {
					const { thumbs: e } = t.params;
					if (e && e.swiper)
						if (
							"string" == typeof e.swiper ||
							e.swiper instanceof HTMLElement
						) {
							const s = a(),
								i = () => {
									const a =
										"string" == typeof e.swiper
											? s.querySelector(e.swiper)
											: e.swiper;
									if (a && a.swiper)
										(e.swiper = a.swiper), o(), c(!0);
									else if (a) {
										const s = (i) => {
											(e.swiper = i.detail[0]),
												a.removeEventListener(
													"init",
													s
												),
												o(),
												c(!0),
												e.swiper.update(),
												t.update();
										};
										a.addEventListener("init", s);
									}
									return a;
								},
								r = () => {
									if (t.destroyed) return;
									i() || requestAnimationFrame(r);
								};
							requestAnimationFrame(r);
						} else o(), c(!0);
				}),
				i("slideChange update resize observerUpdate", () => {
					c();
				}),
				i("setTransition", (e, s) => {
					const a = t.thumbs.swiper;
					a && !a.destroyed && a.setTransition(s);
				}),
				i("beforeDestroy", () => {
					const e = t.thumbs.swiper;
					e && !e.destroyed && n && e.destroy();
				}),
				Object.assign(t.thumbs, { init: o, update: c });
		},
		function (e) {
			let { swiper: t, extendParams: s, emit: a, once: i } = e;
			s({
				freeMode: {
					enabled: !1,
					momentum: !0,
					momentumRatio: 1,
					momentumBounce: !0,
					momentumBounceRatio: 1,
					momentumVelocityRatio: 1,
					sticky: !1,
					minimumVelocity: 0.02,
				},
			}),
				Object.assign(t, {
					freeMode: {
						onTouchStart: function () {
							if (t.params.cssMode) return;
							const e = t.getTranslate();
							t.setTranslate(e),
								t.setTransition(0),
								(t.touchEventsData.velocities.length = 0),
								t.freeMode.onTouchEnd({
									currentPos: t.rtl
										? t.translate
										: -t.translate,
								});
						},
						onTouchMove: function () {
							if (t.params.cssMode) return;
							const { touchEventsData: e, touches: s } = t;
							0 === e.velocities.length &&
								e.velocities.push({
									position:
										s[
											t.isHorizontal()
												? "startX"
												: "startY"
										],
									time: e.touchStartTime,
								}),
								e.velocities.push({
									position:
										s[
											t.isHorizontal()
												? "currentX"
												: "currentY"
										],
									time: l(),
								});
						},
						onTouchEnd: function (e) {
							let { currentPos: s } = e;
							if (t.params.cssMode) return;
							const {
									params: r,
									wrapperEl: n,
									rtlTranslate: o,
									snapGrid: d,
									touchEventsData: c,
								} = t,
								p = l() - c.touchStartTime;
							if (s < -t.minTranslate()) t.slideTo(t.activeIndex);
							else if (s > -t.maxTranslate())
								t.slides.length < d.length
									? t.slideTo(d.length - 1)
									: t.slideTo(t.slides.length - 1);
							else {
								if (r.freeMode.momentum) {
									if (c.velocities.length > 1) {
										const e = c.velocities.pop(),
											s = c.velocities.pop(),
											a = e.position - s.position,
											i = e.time - s.time;
										(t.velocity = a / i),
											(t.velocity /= 2),
											Math.abs(t.velocity) <
												r.freeMode.minimumVelocity &&
												(t.velocity = 0),
											(i > 150 || l() - e.time > 300) &&
												(t.velocity = 0);
									} else t.velocity = 0;
									(t.velocity *=
										r.freeMode.momentumVelocityRatio),
										(c.velocities.length = 0);
									let e = 1e3 * r.freeMode.momentumRatio;
									const s = t.velocity * e;
									let p = t.translate + s;
									o && (p = -p);
									let u,
										m = !1;
									const h =
										20 *
										Math.abs(t.velocity) *
										r.freeMode.momentumBounceRatio;
									let f;
									if (p < t.maxTranslate())
										r.freeMode.momentumBounce
											? (p + t.maxTranslate() < -h &&
													(p = t.maxTranslate() - h),
											  (u = t.maxTranslate()),
											  (m = !0),
											  (c.allowMomentumBounce = !0))
											: (p = t.maxTranslate()),
											r.loop &&
												r.centeredSlides &&
												(f = !0);
									else if (p > t.minTranslate())
										r.freeMode.momentumBounce
											? (p - t.minTranslate() > h &&
													(p = t.minTranslate() + h),
											  (u = t.minTranslate()),
											  (m = !0),
											  (c.allowMomentumBounce = !0))
											: (p = t.minTranslate()),
											r.loop &&
												r.centeredSlides &&
												(f = !0);
									else if (r.freeMode.sticky) {
										let e;
										for (let t = 0; t < d.length; t += 1)
											if (d[t] > -p) {
												e = t;
												break;
											}
										(p =
											Math.abs(d[e] - p) <
												Math.abs(d[e - 1] - p) ||
											"next" === t.swipeDirection
												? d[e]
												: d[e - 1]),
											(p = -p);
									}
									if (
										(f &&
											i("transitionEnd", () => {
												t.loopFix();
											}),
										0 !== t.velocity)
									) {
										if (
											((e = o
												? Math.abs(
														(-p - t.translate) /
															t.velocity
												  )
												: Math.abs(
														(p - t.translate) /
															t.velocity
												  )),
											r.freeMode.sticky)
										) {
											const s = Math.abs(
													(o ? -p : p) - t.translate
												),
												a =
													t.slidesSizesGrid[
														t.activeIndex
													];
											e =
												s < a
													? r.speed
													: s < 2 * a
													? 1.5 * r.speed
													: 2.5 * r.speed;
										}
									} else if (r.freeMode.sticky)
										return void t.slideToClosest();
									r.freeMode.momentumBounce && m
										? (t.updateProgress(u),
										  t.setTransition(e),
										  t.setTranslate(p),
										  t.transitionStart(
												!0,
												t.swipeDirection
										  ),
										  (t.animating = !0),
										  E(n, () => {
												t &&
													!t.destroyed &&
													c.allowMomentumBounce &&
													(a("momentumBounce"),
													t.setTransition(r.speed),
													setTimeout(() => {
														t.setTranslate(u),
															E(n, () => {
																t &&
																	!t.destroyed &&
																	t.transitionEnd();
															});
													}, 0));
										  }))
										: t.velocity
										? (a("_freeModeNoMomentumRelease"),
										  t.updateProgress(p),
										  t.setTransition(e),
										  t.setTranslate(p),
										  t.transitionStart(
												!0,
												t.swipeDirection
										  ),
										  t.animating ||
												((t.animating = !0),
												E(n, () => {
													t &&
														!t.destroyed &&
														t.transitionEnd();
												})))
										: t.updateProgress(p),
										t.updateActiveIndex(),
										t.updateSlidesClasses();
								} else {
									if (r.freeMode.sticky)
										return void t.slideToClosest();
									r.freeMode &&
										a("_freeModeNoMomentumRelease");
								}
								(!r.freeMode.momentum || p >= r.longSwipesMs) &&
									(t.updateProgress(),
									t.updateActiveIndex(),
									t.updateSlidesClasses());
							}
						},
					},
				});
		},
		function (e) {
			let t,
				s,
				a,
				{ swiper: i, extendParams: r } = e;
			r({ grid: { rows: 1, fill: "column" } });
			const n = () => {
				let e = i.params.spaceBetween;
				return (
					"string" == typeof e && e.indexOf("%") >= 0
						? (e = (parseFloat(e.replace("%", "")) / 100) * i.size)
						: "string" == typeof e && (e = parseFloat(e)),
					e
				);
			};
			i.grid = {
				initSlides: (e) => {
					const { slidesPerView: r } = i.params,
						{ rows: n, fill: l } = i.params.grid;
					(a = Math.floor(e / n)),
						(t =
							Math.floor(e / n) === e / n
								? e
								: Math.ceil(e / n) * n),
						"auto" !== r && "row" === l && (t = Math.max(t, r * n)),
						(s = t / n);
				},
				updateSlide: (e, r, l, o) => {
					const { slidesPerGroup: d } = i.params,
						c = n(),
						{ rows: p, fill: u } = i.params.grid;
					let m, h, f;
					if ("row" === u && d > 1) {
						const s = Math.floor(e / (d * p)),
							a = e - p * d * s,
							i =
								0 === s
									? d
									: Math.min(
											Math.ceil((l - s * p * d) / p),
											d
									  );
						(f = Math.floor(a / i)),
							(h = a - f * i + s * d),
							(m = h + (f * t) / p),
							(r.style.order = m);
					} else
						"column" === u
							? ((h = Math.floor(e / p)),
							  (f = e - h * p),
							  (h > a || (h === a && f === p - 1)) &&
									((f += 1), f >= p && ((f = 0), (h += 1))))
							: ((f = Math.floor(e / s)), (h = e - f * s));
					(r.row = f),
						(r.column = h),
						(r.style[o("margin-top")] =
							0 !== f ? c && `${c}px` : "");
				},
				updateWrapperSize: (e, s, a) => {
					const { centeredSlides: r, roundLengths: l } = i.params,
						o = n(),
						{ rows: d } = i.params.grid;
					if (
						((i.virtualSize = (e + o) * t),
						(i.virtualSize = Math.ceil(i.virtualSize / d) - o),
						(i.wrapperEl.style[a("width")] = `${
							i.virtualSize + o
						}px`),
						r)
					) {
						const e = [];
						for (let t = 0; t < s.length; t += 1) {
							let a = s[t];
							l && (a = Math.floor(a)),
								s[t] < i.virtualSize + s[0] && e.push(a);
						}
						s.splice(0, s.length), s.push(...e);
					}
				},
			};
		},
		function (e) {
			let { swiper: t } = e;
			Object.assign(t, {
				appendSlide: se.bind(t),
				prependSlide: ae.bind(t),
				addSlide: ie.bind(t),
				removeSlide: re.bind(t),
				removeAllSlides: ne.bind(t),
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({ fadeEffect: { crossFade: !1 } }),
				le({
					effect: "fade",
					swiper: t,
					on: a,
					setTranslate: () => {
						const { slides: e } = t;
						t.params.fadeEffect;
						for (let s = 0; s < e.length; s += 1) {
							const e = t.slides[s];
							let a = -e.swiperSlideOffset;
							t.params.virtualTranslate || (a -= t.translate);
							let i = 0;
							t.isHorizontal() || ((i = a), (a = 0));
							const r = t.params.fadeEffect.crossFade
									? Math.max(1 - Math.abs(e.progress), 0)
									: 1 + Math.min(Math.max(e.progress, -1), 0),
								n = oe(0, e);
							(n.style.opacity = r),
								(n.style.transform = `translate3d(${a}px, ${i}px, 0px)`);
						}
					},
					setTransition: (e) => {
						const s = t.slides.map((e) => h(e));
						s.forEach((t) => {
							t.style.transitionDuration = `${e}ms`;
						}),
							de({
								swiper: t,
								duration: e,
								transformElements: s,
								allSlides: !0,
							});
					},
					overwriteParams: () => ({
						slidesPerView: 1,
						slidesPerGroup: 1,
						watchSlidesProgress: !0,
						spaceBetween: 0,
						virtualTranslate: !t.params.cssMode,
					}),
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				cubeEffect: {
					slideShadows: !0,
					shadow: !0,
					shadowOffset: 20,
					shadowScale: 0.94,
				},
			});
			const i = (e, t, s) => {
				let a = s
						? e.querySelector(".swiper-slide-shadow-left")
						: e.querySelector(".swiper-slide-shadow-top"),
					i = s
						? e.querySelector(".swiper-slide-shadow-right")
						: e.querySelector(".swiper-slide-shadow-bottom");
				a ||
					((a = g(
						"div",
						"swiper-slide-shadow-" + (s ? "left" : "top")
					)),
					e.append(a)),
					i ||
						((i = g(
							"div",
							"swiper-slide-shadow-" + (s ? "right" : "bottom")
						)),
						e.append(i)),
					a && (a.style.opacity = Math.max(-t, 0)),
					i && (i.style.opacity = Math.max(t, 0));
			};
			le({
				effect: "cube",
				swiper: t,
				on: a,
				setTranslate: () => {
					const {
							el: e,
							wrapperEl: s,
							slides: a,
							width: r,
							height: n,
							rtlTranslate: l,
							size: o,
							browser: d,
						} = t,
						c = t.params.cubeEffect,
						p = t.isHorizontal(),
						u = t.virtual && t.params.virtual.enabled;
					let m,
						h = 0;
					c.shadow &&
						(p
							? ((m = t.slidesEl.querySelector(
									".swiper-cube-shadow"
							  )),
							  m ||
									((m = g("div", "swiper-cube-shadow")),
									t.slidesEl.append(m)),
							  (m.style.height = `${r}px`))
							: ((m = e.querySelector(".swiper-cube-shadow")),
							  m ||
									((m = g("div", "swiper-cube-shadow")),
									e.append(m))));
					for (let e = 0; e < a.length; e += 1) {
						const t = a[e];
						let s = e;
						u &&
							(s = parseInt(
								t.getAttribute("data-swiper-slide-index"),
								10
							));
						let r = 90 * s,
							n = Math.floor(r / 360);
						l && ((r = -r), (n = Math.floor(-r / 360)));
						const d = Math.max(Math.min(t.progress, 1), -1);
						let m = 0,
							f = 0,
							g = 0;
						s % 4 == 0
							? ((m = 4 * -n * o), (g = 0))
							: (s - 1) % 4 == 0
							? ((m = 0), (g = 4 * -n * o))
							: (s - 2) % 4 == 0
							? ((m = o + 4 * n * o), (g = o))
							: (s - 3) % 4 == 0 &&
							  ((m = -o), (g = 3 * o + 4 * o * n)),
							l && (m = -m),
							p || ((f = m), (m = 0));
						const v = `rotateX(${p ? 0 : -r}deg) rotateY(${
							p ? r : 0
						}deg) translate3d(${m}px, ${f}px, ${g}px)`;
						d <= 1 &&
							d > -1 &&
							((h = 90 * s + 90 * d),
							l && (h = 90 * -s - 90 * d)),
							(t.style.transform = v),
							c.slideShadows && i(t, d, p);
					}
					if (
						((s.style.transformOrigin = `50% 50% -${o / 2}px`),
						(s.style["-webkit-transform-origin"] = `50% 50% -${
							o / 2
						}px`),
						c.shadow)
					)
						if (p)
							m.style.transform = `translate3d(0px, ${
								r / 2 + c.shadowOffset
							}px, ${
								-r / 2
							}px) rotateX(90deg) rotateZ(0deg) scale(${
								c.shadowScale
							})`;
						else {
							const e =
									Math.abs(h) -
									90 * Math.floor(Math.abs(h) / 90),
								t =
									1.5 -
									(Math.sin((2 * e * Math.PI) / 360) / 2 +
										Math.cos((2 * e * Math.PI) / 360) / 2),
								s = c.shadowScale,
								a = c.shadowScale / t,
								i = c.shadowOffset;
							m.style.transform = `scale3d(${s}, 1, ${a}) translate3d(0px, ${
								n / 2 + i
							}px, ${-n / 2 / a}px) rotateX(-90deg)`;
						}
					const f =
						(d.isSafari || d.isWebView) && d.needPerspectiveFix
							? -o / 2
							: 0;
					(s.style.transform = `translate3d(0px,0,${f}px) rotateX(${
						t.isHorizontal() ? 0 : h
					}deg) rotateY(${t.isHorizontal() ? -h : 0}deg)`),
						s.style.setProperty(
							"--swiper-cube-translate-z",
							`${f}px`
						);
				},
				setTransition: (e) => {
					const { el: s, slides: a } = t;
					if (
						(a.forEach((t) => {
							(t.style.transitionDuration = `${e}ms`),
								t
									.querySelectorAll(
										".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left"
									)
									.forEach((t) => {
										t.style.transitionDuration = `${e}ms`;
									});
						}),
						t.params.cubeEffect.shadow && !t.isHorizontal())
					) {
						const t = s.querySelector(".swiper-cube-shadow");
						t && (t.style.transitionDuration = `${e}ms`);
					}
				},
				recreateShadows: () => {
					const e = t.isHorizontal();
					t.slides.forEach((t) => {
						const s = Math.max(Math.min(t.progress, 1), -1);
						i(t, s, e);
					});
				},
				getEffectParams: () => t.params.cubeEffect,
				perspective: () => !0,
				overwriteParams: () => ({
					slidesPerView: 1,
					slidesPerGroup: 1,
					watchSlidesProgress: !0,
					resistanceRatio: 0,
					spaceBetween: 0,
					centeredSlides: !1,
					virtualTranslate: !0,
				}),
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({ flipEffect: { slideShadows: !0, limitRotation: !0 } });
			const i = (e, s, a) => {
				let i = t.isHorizontal()
						? e.querySelector(".swiper-slide-shadow-left")
						: e.querySelector(".swiper-slide-shadow-top"),
					r = t.isHorizontal()
						? e.querySelector(".swiper-slide-shadow-right")
						: e.querySelector(".swiper-slide-shadow-bottom");
				i || (i = ce(0, e, t.isHorizontal() ? "left" : "top")),
					r || (r = ce(0, e, t.isHorizontal() ? "right" : "bottom")),
					i && (i.style.opacity = Math.max(-s, 0)),
					r && (r.style.opacity = Math.max(s, 0));
			};
			le({
				effect: "flip",
				swiper: t,
				on: a,
				setTranslate: () => {
					const { slides: e, rtlTranslate: s } = t,
						a = t.params.flipEffect;
					for (let r = 0; r < e.length; r += 1) {
						const n = e[r];
						let l = n.progress;
						t.params.flipEffect.limitRotation &&
							(l = Math.max(Math.min(n.progress, 1), -1));
						const o = n.swiperSlideOffset;
						let d = -180 * l,
							c = 0,
							p = t.params.cssMode ? -o - t.translate : -o,
							u = 0;
						t.isHorizontal()
							? s && (d = -d)
							: ((u = p), (p = 0), (c = -d), (d = 0)),
							(n.style.zIndex =
								-Math.abs(Math.round(l)) + e.length),
							a.slideShadows && i(n, l);
						const m = `translate3d(${p}px, ${u}px, 0px) rotateX(${c}deg) rotateY(${d}deg)`;
						oe(0, n).style.transform = m;
					}
				},
				setTransition: (e) => {
					const s = t.slides.map((e) => h(e));
					s.forEach((t) => {
						(t.style.transitionDuration = `${e}ms`),
							t
								.querySelectorAll(
									".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left"
								)
								.forEach((t) => {
									t.style.transitionDuration = `${e}ms`;
								});
					}),
						de({ swiper: t, duration: e, transformElements: s });
				},
				recreateShadows: () => {
					t.params.flipEffect;
					t.slides.forEach((e) => {
						let s = e.progress;
						t.params.flipEffect.limitRotation &&
							(s = Math.max(Math.min(e.progress, 1), -1)),
							i(e, s);
					});
				},
				getEffectParams: () => t.params.flipEffect,
				perspective: () => !0,
				overwriteParams: () => ({
					slidesPerView: 1,
					slidesPerGroup: 1,
					watchSlidesProgress: !0,
					spaceBetween: 0,
					virtualTranslate: !t.params.cssMode,
				}),
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				coverflowEffect: {
					rotate: 50,
					stretch: 0,
					depth: 100,
					scale: 1,
					modifier: 1,
					slideShadows: !0,
				},
			}),
				le({
					effect: "coverflow",
					swiper: t,
					on: a,
					setTranslate: () => {
						const {
								width: e,
								height: s,
								slides: a,
								slidesSizesGrid: i,
							} = t,
							r = t.params.coverflowEffect,
							n = t.isHorizontal(),
							l = t.translate,
							o = n ? e / 2 - l : s / 2 - l,
							d = n ? r.rotate : -r.rotate,
							c = r.depth;
						for (let e = 0, t = a.length; e < t; e += 1) {
							const t = a[e],
								s = i[e],
								l = (o - t.swiperSlideOffset - s / 2) / s,
								p =
									"function" == typeof r.modifier
										? r.modifier(l)
										: l * r.modifier;
							let u = n ? d * p : 0,
								m = n ? 0 : d * p,
								h = -c * Math.abs(p),
								f = r.stretch;
							"string" == typeof f &&
								-1 !== f.indexOf("%") &&
								(f = (parseFloat(r.stretch) / 100) * s);
							let g = n ? 0 : f * p,
								v = n ? f * p : 0,
								w = 1 - (1 - r.scale) * Math.abs(p);
							Math.abs(v) < 0.001 && (v = 0),
								Math.abs(g) < 0.001 && (g = 0),
								Math.abs(h) < 0.001 && (h = 0),
								Math.abs(u) < 0.001 && (u = 0),
								Math.abs(m) < 0.001 && (m = 0),
								Math.abs(w) < 0.001 && (w = 0);
							const b = `translate3d(${v}px,${g}px,${h}px)  rotateX(${m}deg) rotateY(${u}deg) scale(${w})`;
							if (
								((oe(0, t).style.transform = b),
								(t.style.zIndex = 1 - Math.abs(Math.round(p))),
								r.slideShadows)
							) {
								let e = n
										? t.querySelector(
												".swiper-slide-shadow-left"
										  )
										: t.querySelector(
												".swiper-slide-shadow-top"
										  ),
									s = n
										? t.querySelector(
												".swiper-slide-shadow-right"
										  )
										: t.querySelector(
												".swiper-slide-shadow-bottom"
										  );
								e || (e = ce(0, t, n ? "left" : "top")),
									s || (s = ce(0, t, n ? "right" : "bottom")),
									e && (e.style.opacity = p > 0 ? p : 0),
									s && (s.style.opacity = -p > 0 ? -p : 0);
							}
						}
					},
					setTransition: (e) => {
						t.slides
							.map((e) => h(e))
							.forEach((t) => {
								(t.style.transitionDuration = `${e}ms`),
									t
										.querySelectorAll(
											".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left"
										)
										.forEach((t) => {
											t.style.transitionDuration = `${e}ms`;
										});
							});
					},
					perspective: () => !0,
					overwriteParams: () => ({ watchSlidesProgress: !0 }),
				});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				creativeEffect: {
					limitProgress: 1,
					shadowPerProgress: !1,
					progressMultiplier: 1,
					perspective: !0,
					prev: {
						translate: [0, 0, 0],
						rotate: [0, 0, 0],
						opacity: 1,
						scale: 1,
					},
					next: {
						translate: [0, 0, 0],
						rotate: [0, 0, 0],
						opacity: 1,
						scale: 1,
					},
				},
			});
			const i = (e) => ("string" == typeof e ? e : `${e}px`);
			le({
				effect: "creative",
				swiper: t,
				on: a,
				setTranslate: () => {
					const { slides: e, wrapperEl: s, slidesSizesGrid: a } = t,
						r = t.params.creativeEffect,
						{ progressMultiplier: n } = r,
						l = t.params.centeredSlides;
					if (l) {
						const e = a[0] / 2 - t.params.slidesOffsetBefore || 0;
						s.style.transform = `translateX(calc(50% - ${e}px))`;
					}
					for (let s = 0; s < e.length; s += 1) {
						const a = e[s],
							o = a.progress,
							d = Math.min(
								Math.max(a.progress, -r.limitProgress),
								r.limitProgress
							);
						let c = d;
						l ||
							(c = Math.min(
								Math.max(a.originalProgress, -r.limitProgress),
								r.limitProgress
							));
						const p = a.swiperSlideOffset,
							u = [
								t.params.cssMode ? -p - t.translate : -p,
								0,
								0,
							],
							m = [0, 0, 0];
						let h = !1;
						t.isHorizontal() || ((u[1] = u[0]), (u[0] = 0));
						let f = {
							translate: [0, 0, 0],
							rotate: [0, 0, 0],
							scale: 1,
							opacity: 1,
						};
						d < 0
							? ((f = r.next), (h = !0))
							: d > 0 && ((f = r.prev), (h = !0)),
							u.forEach((e, t) => {
								u[t] = `calc(${e}px + (${i(
									f.translate[t]
								)} * ${Math.abs(d * n)}))`;
							}),
							m.forEach((e, t) => {
								m[t] = f.rotate[t] * Math.abs(d * n);
							}),
							(a.style.zIndex =
								-Math.abs(Math.round(o)) + e.length);
						const g = u.join(", "),
							v = `rotateX(${m[0]}deg) rotateY(${m[1]}deg) rotateZ(${m[2]}deg)`,
							w =
								c < 0
									? `scale(${1 + (1 - f.scale) * c * n})`
									: `scale(${1 - (1 - f.scale) * c * n})`,
							b =
								c < 0
									? 1 + (1 - f.opacity) * c * n
									: 1 - (1 - f.opacity) * c * n,
							y = `translate3d(${g}) ${v} ${w}`;
						if ((h && f.shadow) || !h) {
							let e = a.querySelector(".swiper-slide-shadow");
							if ((!e && f.shadow && (e = ce(0, a)), e)) {
								const t = r.shadowPerProgress
									? d * (1 / r.limitProgress)
									: d;
								e.style.opacity = Math.min(
									Math.max(Math.abs(t), 0),
									1
								);
							}
						}
						const E = oe(0, a);
						(E.style.transform = y),
							(E.style.opacity = b),
							f.origin && (E.style.transformOrigin = f.origin);
					}
				},
				setTransition: (e) => {
					const s = t.slides.map((e) => h(e));
					s.forEach((t) => {
						(t.style.transitionDuration = `${e}ms`),
							t
								.querySelectorAll(".swiper-slide-shadow")
								.forEach((t) => {
									t.style.transitionDuration = `${e}ms`;
								});
					}),
						de({
							swiper: t,
							duration: e,
							transformElements: s,
							allSlides: !0,
						});
				},
				perspective: () => t.params.creativeEffect.perspective,
				overwriteParams: () => ({
					watchSlidesProgress: !0,
					virtualTranslate: !t.params.cssMode,
				}),
			});
		},
		function (e) {
			let { swiper: t, extendParams: s, on: a } = e;
			s({
				cardsEffect: {
					slideShadows: !0,
					rotate: !0,
					perSlideRotate: 2,
					perSlideOffset: 8,
				},
			}),
				le({
					effect: "cards",
					swiper: t,
					on: a,
					setTranslate: () => {
						const {
								slides: e,
								activeIndex: s,
								rtlTranslate: a,
							} = t,
							i = t.params.cardsEffect,
							{ startTranslate: r, isTouched: n } =
								t.touchEventsData,
							l = a ? -t.translate : t.translate;
						for (let o = 0; o < e.length; o += 1) {
							const d = e[o],
								c = d.progress,
								p = Math.min(Math.max(c, -4), 4);
							let u = d.swiperSlideOffset;
							t.params.centeredSlides &&
								!t.params.cssMode &&
								(t.wrapperEl.style.transform = `translateX(${t.minTranslate()}px)`),
								t.params.centeredSlides &&
									t.params.cssMode &&
									(u -= e[0].swiperSlideOffset);
							let m = t.params.cssMode ? -u - t.translate : -u,
								h = 0;
							const f = -100 * Math.abs(p);
							let g = 1,
								v = -i.perSlideRotate * p,
								w = i.perSlideOffset - 0.75 * Math.abs(p);
							const b =
									t.virtual && t.params.virtual.enabled
										? t.virtual.from + o
										: o,
								y =
									(b === s || b === s - 1) &&
									p > 0 &&
									p < 1 &&
									(n || t.params.cssMode) &&
									l < r,
								E =
									(b === s || b === s + 1) &&
									p < 0 &&
									p > -1 &&
									(n || t.params.cssMode) &&
									l > r;
							if (y || E) {
								const e =
									(1 - Math.abs((Math.abs(p) - 0.5) / 0.5)) **
									0.5;
								(v += -28 * p * e),
									(g += -0.5 * e),
									(w += 96 * e),
									(h = -25 * e * Math.abs(p) + "%");
							}
							if (
								((m =
									p < 0
										? `calc(${m}px ${a ? "-" : "+"} (${
												w * Math.abs(p)
										  }%))`
										: p > 0
										? `calc(${m}px ${a ? "-" : "+"} (-${
												w * Math.abs(p)
										  }%))`
										: `${m}px`),
								!t.isHorizontal())
							) {
								const e = h;
								(h = m), (m = e);
							}
							const x =
									p < 0
										? "" + (1 + (1 - g) * p)
										: "" + (1 - (1 - g) * p),
								S = `\n        translate3d(${m}, ${h}, ${f}px)\n        rotateZ(${
									i.rotate ? (a ? -v : v) : 0
								}deg)\n        scale(${x})\n      `;
							if (i.slideShadows) {
								let e = d.querySelector(".swiper-slide-shadow");
								e || (e = ce(0, d)),
									e &&
										(e.style.opacity = Math.min(
											Math.max(
												(Math.abs(p) - 0.5) / 0.5,
												0
											),
											1
										));
							}
							d.style.zIndex =
								-Math.abs(Math.round(c)) + e.length;
							oe(0, d).style.transform = S;
						}
					},
					setTransition: (e) => {
						const s = t.slides.map((e) => h(e));
						s.forEach((t) => {
							(t.style.transitionDuration = `${e}ms`),
								t
									.querySelectorAll(".swiper-slide-shadow")
									.forEach((t) => {
										t.style.transitionDuration = `${e}ms`;
									});
						}),
							de({
								swiper: t,
								duration: e,
								transformElements: s,
							});
					},
					perspective: () => !0,
					overwriteParams: () => ({
						watchSlidesProgress: !0,
						virtualTranslate: !t.params.cssMode,
					}),
				});
		},
	];
	return J.use(pe), J;
});
//# sourceMappingURL=swiper-bundle.min.js.map

/*!
 * jQuery Validation Plugin v1.19.3
 *
 * https://jqueryvalidation.org/
 * 
 * Copyright (c) 2021 Jörn Zaefferer
 * Released under the MIT license
 */
(function( factory ) {
	if ( typeof define === "function" && define.amd ) {
		define( ["jquery"], factory );
	} else if (typeof module === "object" && module.exports) {
		module.exports = factory( require( "jquery" ) );
	} else {
		factory( jQuery );
	}
}(function( $ ) {

$.extend( $.fn, {

	// https://jqueryvalidation.org/validate/
	validate: function( options ) {

		// If nothing is selected, return nothing; can't chain anyway
		if ( !this.length ) {
			if ( options && options.debug && window.console ) {
				console.warn( "Nothing selected, can't validate, returning nothing." );
			}
			return;
		}

		// Check if a validator for this form was already created
		var validator = $.data( this[ 0 ], "validator" );
		if ( validator ) {
			return validator;
		}

		// Add novalidate tag if HTML5.
		this.attr( "novalidate", "novalidate" );

		validator = new $.validator( options, this[ 0 ] );
		$.data( this[ 0 ], "validator", validator );

		if ( validator.settings.onsubmit ) {

			this.on( "click.validate", ":submit", function( event ) {

				// Track the used submit button to properly handle scripted
				// submits later.
				validator.submitButton = event.currentTarget;

				// Allow suppressing validation by adding a cancel class to the submit button
				if ( $( this ).hasClass( "cancel" ) ) {
					validator.cancelSubmit = true;
				}

				// Allow suppressing validation by adding the html5 formnovalidate attribute to the submit button
				if ( $( this ).attr( "formnovalidate" ) !== undefined ) {
					validator.cancelSubmit = true;
				}
			} );

			// Validate the form on submit
			this.on( "submit.validate", function( event ) {
				if ( validator.settings.debug ) {

					// Prevent form submit to be able to see console output
					event.preventDefault();
				}

				function handle() {
					var hidden, result;

					// Insert a hidden input as a replacement for the missing submit button
					// The hidden input is inserted in two cases:
					//   - A user defined a `submitHandler`
					//   - There was a pending request due to `remote` method and `stopRequest()`
					//     was called to submit the form in case it's valid
					if ( validator.submitButton && ( validator.settings.submitHandler || validator.formSubmitted ) ) {
						hidden = $( "<input type='hidden'/>" )
							.attr( "name", validator.submitButton.name )
							.val( $( validator.submitButton ).val() )
							.appendTo( validator.currentForm );
					}

					if ( validator.settings.submitHandler && !validator.settings.debug ) {
						result = validator.settings.submitHandler.call( validator, validator.currentForm, event );
						if ( hidden ) {

							// And clean up afterwards; thanks to no-block-scope, hidden can be referenced
							hidden.remove();
						}
						if ( result !== undefined ) {
							return result;
						}
						return false;
					}
					return true;
				}

				// Prevent submit for invalid forms or custom submit handlers
				if ( validator.cancelSubmit ) {
					validator.cancelSubmit = false;
					return handle();
				}
				if ( validator.form() ) {
					if ( validator.pendingRequest ) {
						validator.formSubmitted = true;
						return false;
					}
					return handle();
				} else {
					validator.focusInvalid();
					return false;
				}
			} );
		}

		return validator;
	},

	// https://jqueryvalidation.org/valid/
	valid: function() {
		var valid, validator, errorList;

		if ( $( this[ 0 ] ).is( "form" ) ) {
			valid = this.validate().form();
		} else {
			errorList = [];
			valid = true;
			validator = $( this[ 0 ].form ).validate();
			this.each( function() {
				valid = validator.element( this ) && valid;
				if ( !valid ) {
					errorList = errorList.concat( validator.errorList );
				}
			} );
			validator.errorList = errorList;
		}
		return valid;
	},

	// https://jqueryvalidation.org/rules/
	rules: function( command, argument ) {
		var element = this[ 0 ],
			isContentEditable = typeof this.attr( "contenteditable" ) !== "undefined" && this.attr( "contenteditable" ) !== "false",
			settings, staticRules, existingRules, data, param, filtered;

		// If nothing is selected, return empty object; can't chain anyway
		if ( element == null ) {
			return;
		}

		if ( !element.form && isContentEditable ) {
			element.form = this.closest( "form" )[ 0 ];
			element.name = this.attr( "name" );
		}

		if ( element.form == null ) {
			return;
		}

		if ( command ) {
			settings = $.data( element.form, "validator" ).settings;
			staticRules = settings.rules;
			existingRules = $.validator.staticRules( element );
			switch ( command ) {
			case "add":
				$.extend( existingRules, $.validator.normalizeRule( argument ) );

				// Remove messages from rules, but allow them to be set separately
				delete existingRules.messages;
				staticRules[ element.name ] = existingRules;
				if ( argument.messages ) {
					settings.messages[ element.name ] = $.extend( settings.messages[ element.name ], argument.messages );
				}
				break;
			case "remove":
				if ( !argument ) {
					delete staticRules[ element.name ];
					return existingRules;
				}
				filtered = {};
				$.each( argument.split( /\s/ ), function( index, method ) {
					filtered[ method ] = existingRules[ method ];
					delete existingRules[ method ];
				} );
				return filtered;
			}
		}

		data = $.validator.normalizeRules(
		$.extend(
			{},
			$.validator.classRules( element ),
			$.validator.attributeRules( element ),
			$.validator.dataRules( element ),
			$.validator.staticRules( element )
		), element );

		// Make sure required is at front
		if ( data.required ) {
			param = data.required;
			delete data.required;
			data = $.extend( { required: param }, data );
		}

		// Make sure remote is at back
		if ( data.remote ) {
			param = data.remote;
			delete data.remote;
			data = $.extend( data, { remote: param } );
		}

		return data;
	}
} );

// JQuery trim is deprecated, provide a trim method based on String.prototype.trim
var trim = function( str ) {

	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim#Polyfill
	return str.replace( /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "" );
};

// Custom selectors
$.extend( $.expr.pseudos || $.expr[ ":" ], {		// '|| $.expr[ ":" ]' here enables backwards compatibility to jQuery 1.7. Can be removed when dropping jQ 1.7.x support

	// https://jqueryvalidation.org/blank-selector/
	blank: function( a ) {
		return !trim( "" + $( a ).val() );
	},

	// https://jqueryvalidation.org/filled-selector/
	filled: function( a ) {
		var val = $( a ).val();
		return val !== null && !!trim( "" + val );
	},

	// https://jqueryvalidation.org/unchecked-selector/
	unchecked: function( a ) {
		return !$( a ).prop( "checked" );
	}
} );

// Constructor for validator
$.validator = function( options, form ) {
	this.settings = $.extend( true, {}, $.validator.defaults, options );
	this.currentForm = form;
	this.init();
};

// https://jqueryvalidation.org/jQuery.validator.format/
$.validator.format = function( source, params ) {
	if ( arguments.length === 1 ) {
		return function() {
			var args = $.makeArray( arguments );
			args.unshift( source );
			return $.validator.format.apply( this, args );
		};
	}
	if ( params === undefined ) {
		return source;
	}
	if ( arguments.length > 2 && params.constructor !== Array  ) {
		params = $.makeArray( arguments ).slice( 1 );
	}
	if ( params.constructor !== Array ) {
		params = [ params ];
	}
	$.each( params, function( i, n ) {
		source = source.replace( new RegExp( "\\{" + i + "\\}", "g" ), function() {
			return n;
		} );
	} );
	return source;
};

$.extend( $.validator, {

	defaults: {
		messages: {},
		groups: {},
		rules: {},
		errorClass: "error",
		pendingClass: "pending",
		validClass: "valid",
		errorElement: "label",
		focusCleanup: false,
		focusInvalid: true,
		errorContainer: $( [] ),
		errorLabelContainer: $( [] ),
		onsubmit: true,
		ignore: ":hidden",
		ignoreTitle: false,
		onfocusin: function( element ) {
			this.lastActive = element;

			// Hide error label and remove error class on focus if enabled
			if ( this.settings.focusCleanup ) {
				if ( this.settings.unhighlight ) {
					this.settings.unhighlight.call( this, element, this.settings.errorClass, this.settings.validClass );
				}
				this.hideThese( this.errorsFor( element ) );
			}
		},
		onfocusout: function( element ) {
			if ( !this.checkable( element ) && ( element.name in this.submitted || !this.optional( element ) ) ) {
				this.element( element );
			}
		},
		onkeyup: function( element, event ) {

			// Avoid revalidate the field when pressing one of the following keys
			// Shift       => 16
			// Ctrl        => 17
			// Alt         => 18
			// Caps lock   => 20
			// End         => 35
			// Home        => 36
			// Left arrow  => 37
			// Up arrow    => 38
			// Right arrow => 39
			// Down arrow  => 40
			// Insert      => 45
			// Num lock    => 144
			// AltGr key   => 225
			var excludedKeys = [
				16, 17, 18, 20, 35, 36, 37,
				38, 39, 40, 45, 144, 225
			];

			if ( event.which === 9 && this.elementValue( element ) === "" || $.inArray( event.keyCode, excludedKeys ) !== -1 ) {
				return;
			} else if ( element.name in this.submitted || element.name in this.invalid ) {
				this.element( element );
			}
		},
		onclick: function( element ) {

			// Click on selects, radiobuttons and checkboxes
			if ( element.name in this.submitted ) {
				this.element( element );

			// Or option elements, check parent select in that case
			} else if ( element.parentNode.name in this.submitted ) {
				this.element( element.parentNode );
			}
		},
		highlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName( element.name ).addClass( errorClass ).removeClass( validClass );
			} else {
				$( element ).addClass( errorClass ).removeClass( validClass );
			}
		},
		unhighlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName( element.name ).removeClass( errorClass ).addClass( validClass );
			} else {
				$( element ).removeClass( errorClass ).addClass( validClass );
			}
		}
	},

	// https://jqueryvalidation.org/jQuery.validator.setDefaults/
	setDefaults: function( settings ) {
		$.extend( $.validator.defaults, settings );
	},

	messages: {
		required: "This field is required.",
		remote: "Please fix this field.",
		email: "Please enter a valid email address.",
		url: "Please enter a valid URL.",
		date: "Please enter a valid date.",
		dateISO: "Please enter a valid date (ISO).",
		number: "Please enter a valid number.",
		digits: "Please enter only digits.",
		equalTo: "Please enter the same value again.",
		maxlength: $.validator.format( "Please enter no more than {0} characters." ),
		minlength: $.validator.format( "Please enter at least {0} characters." ),
		rangelength: $.validator.format( "Please enter a value between {0} and {1} characters long." ),
		range: $.validator.format( "Please enter a value between {0} and {1}." ),
		max: $.validator.format( "Please enter a value less than or equal to {0}." ),
		min: $.validator.format( "Please enter a value greater than or equal to {0}." ),
		step: $.validator.format( "Please enter a multiple of {0}." )
	},

	autoCreateRanges: false,

	prototype: {

		init: function() {
			this.labelContainer = $( this.settings.errorLabelContainer );
			this.errorContext = this.labelContainer.length && this.labelContainer || $( this.currentForm );
			this.containers = $( this.settings.errorContainer ).add( this.settings.errorLabelContainer );
			this.submitted = {};
			this.valueCache = {};
			this.pendingRequest = 0;
			this.pending = {};
			this.invalid = {};
			this.reset();

			var currentForm = this.currentForm,
				groups = ( this.groups = {} ),
				rules;
			$.each( this.settings.groups, function( key, value ) {
				if ( typeof value === "string" ) {
					value = value.split( /\s/ );
				}
				$.each( value, function( index, name ) {
					groups[ name ] = key;
				} );
			} );
			rules = this.settings.rules;
			$.each( rules, function( key, value ) {
				rules[ key ] = $.validator.normalizeRule( value );
			} );

			function delegate( event ) {
				var isContentEditable = typeof $( this ).attr( "contenteditable" ) !== "undefined" && $( this ).attr( "contenteditable" ) !== "false";

				// Set form expando on contenteditable
				if ( !this.form && isContentEditable ) {
					this.form = $( this ).closest( "form" )[ 0 ];
					this.name = $( this ).attr( "name" );
				}

				// Ignore the element if it belongs to another form. This will happen mainly
				// when setting the `form` attribute of an input to the id of another form.
				if ( currentForm !== this.form ) {
					return;
				}

				var validator = $.data( this.form, "validator" ),
					eventType = "on" + event.type.replace( /^validate/, "" ),
					settings = validator.settings;
				if ( settings[ eventType ] && !$( this ).is( settings.ignore ) ) {
					settings[ eventType ].call( validator, this, event );
				}
			}

			$( this.currentForm )
				.on( "focusin.validate focusout.validate keyup.validate",
					":text, [type='password'], [type='file'], select, textarea, [type='number'], [type='search'], " +
					"[type='tel'], [type='url'], [type='email'], [type='datetime'], [type='date'], [type='month'], " +
					"[type='week'], [type='time'], [type='datetime-local'], [type='range'], [type='color'], " +
					"[type='radio'], [type='checkbox'], [contenteditable], [type='button']", delegate )

				// Support: Chrome, oldIE
				// "select" is provided as event.target when clicking a option
				.on( "click.validate", "select, option, [type='radio'], [type='checkbox']", delegate );

			if ( this.settings.invalidHandler ) {
				$( this.currentForm ).on( "invalid-form.validate", this.settings.invalidHandler );
			}
		},

		// https://jqueryvalidation.org/Validator.form/
		form: function() {
			this.checkForm();
			$.extend( this.submitted, this.errorMap );
			this.invalid = $.extend( {}, this.errorMap );
			if ( !this.valid() ) {
				$( this.currentForm ).triggerHandler( "invalid-form", [ this ] );
			}
			this.showErrors();
			return this.valid();
		},

		checkForm: function() {
			this.prepareForm();
			for ( var i = 0, elements = ( this.currentElements = this.elements() ); elements[ i ]; i++ ) {
				this.check( elements[ i ] );
			}
			return this.valid();
		},

		// https://jqueryvalidation.org/Validator.element/
		element: function( element ) {
			var cleanElement = this.clean( element ),
				checkElement = this.validationTargetFor( cleanElement ),
				v = this,
				result = true,
				rs, group;

			if ( checkElement === undefined ) {
				delete this.invalid[ cleanElement.name ];
			} else {
				this.prepareElement( checkElement );
				this.currentElements = $( checkElement );

				// If this element is grouped, then validate all group elements already
				// containing a value
				group = this.groups[ checkElement.name ];
				if ( group ) {
					$.each( this.groups, function( name, testgroup ) {
						if ( testgroup === group && name !== checkElement.name ) {
							cleanElement = v.validationTargetFor( v.clean( v.findByName( name ) ) );
							if ( cleanElement && cleanElement.name in v.invalid ) {
								v.currentElements.push( cleanElement );
								result = v.check( cleanElement ) && result;
							}
						}
					} );
				}

				rs = this.check( checkElement ) !== false;
				result = result && rs;
				if ( rs ) {
					this.invalid[ checkElement.name ] = false;
				} else {
					this.invalid[ checkElement.name ] = true;
				}

				if ( !this.numberOfInvalids() ) {

					// Hide error containers on last error
					this.toHide = this.toHide.add( this.containers );
				}
				this.showErrors();

				// Add aria-invalid status for screen readers
				$( element ).attr( "aria-invalid", !rs );
			}

			return result;
		},

		// https://jqueryvalidation.org/Validator.showErrors/
		showErrors: function( errors ) {
			if ( errors ) {
				var validator = this;

				// Add items to error list and map
				$.extend( this.errorMap, errors );
				this.errorList = $.map( this.errorMap, function( message, name ) {
					return {
						message: message,
						element: validator.findByName( name )[ 0 ]
					};
				} );

				// Remove items from success list
				this.successList = $.grep( this.successList, function( element ) {
					return !( element.name in errors );
				} );
			}
			if ( this.settings.showErrors ) {
				this.settings.showErrors.call( this, this.errorMap, this.errorList );
			} else {
				this.defaultShowErrors();
			}
		},

		// https://jqueryvalidation.org/Validator.resetForm/
		resetForm: function() {
			if ( $.fn.resetForm ) {
				$( this.currentForm ).resetForm();
			}
			this.invalid = {};
			this.submitted = {};
			this.prepareForm();
			this.hideErrors();
			var elements = this.elements()
				.removeData( "previousValue" )
				.removeAttr( "aria-invalid" );

			this.resetElements( elements );
		},

		resetElements: function( elements ) {
			var i;

			if ( this.settings.unhighlight ) {
				for ( i = 0; elements[ i ]; i++ ) {
					this.settings.unhighlight.call( this, elements[ i ],
						this.settings.errorClass, "" );
					this.findByName( elements[ i ].name ).removeClass( this.settings.validClass );
				}
			} else {
				elements
					.removeClass( this.settings.errorClass )
					.removeClass( this.settings.validClass );
			}
		},

		numberOfInvalids: function() {
			return this.objectLength( this.invalid );
		},

		objectLength: function( obj ) {
			/* jshint unused: false */
			var count = 0,
				i;
			for ( i in obj ) {

				// This check allows counting elements with empty error
				// message as invalid elements
				if ( obj[ i ] !== undefined && obj[ i ] !== null && obj[ i ] !== false ) {
					count++;
				}
			}
			return count;
		},

		hideErrors: function() {
			this.hideThese( this.toHide );
		},

		hideThese: function( errors ) {
			errors.not( this.containers ).text( "" );
			this.addWrapper( errors ).hide();
		},

		valid: function() {
			return this.size() === 0;
		},

		size: function() {
			return this.errorList.length;
		},

		focusInvalid: function() {
			if ( this.settings.focusInvalid ) {
				try {
					$( this.findLastActive() || this.errorList.length && this.errorList[ 0 ].element || [] )
					.filter( ":visible" )
					.trigger( "focus" )

					// Manually trigger focusin event; without it, focusin handler isn't called, findLastActive won't have anything to find
					.trigger( "focusin" );
				} catch ( e ) {

					// Ignore IE throwing errors when focusing hidden elements
				}
			}
		},

		findLastActive: function() {
			var lastActive = this.lastActive;
			return lastActive && $.grep( this.errorList, function( n ) {
				return n.element.name === lastActive.name;
			} ).length === 1 && lastActive;
		},

		elements: function() {
			var validator = this,
				rulesCache = {};

			// Select all valid inputs inside the form (no submit or reset buttons)
			return $( this.currentForm )
			.find( "input, select, textarea, [contenteditable]" )
			.not( ":submit, :reset, :image, :disabled" )
			.not( this.settings.ignore )
			.filter( function() {
				var name = this.name || $( this ).attr( "name" ); // For contenteditable
				var isContentEditable = typeof $( this ).attr( "contenteditable" ) !== "undefined" && $( this ).attr( "contenteditable" ) !== "false";

				if ( !name && validator.settings.debug && window.console ) {
					console.error( "%o has no name assigned", this );
				}

				// Set form expando on contenteditable
				if ( isContentEditable ) {
					this.form = $( this ).closest( "form" )[ 0 ];
					this.name = name;
				}

				// Ignore elements that belong to other/nested forms
				if ( this.form !== validator.currentForm ) {
					return false;
				}

				// Select only the first element for each name, and only those with rules specified
				if ( name in rulesCache || !validator.objectLength( $( this ).rules() ) ) {
					return false;
				}

				rulesCache[ name ] = true;
				return true;
			} );
		},

		clean: function( selector ) {
			return $( selector )[ 0 ];
		},

		errors: function() {
			var errorClass = this.settings.errorClass.split( " " ).join( "." );
			return $( this.settings.errorElement + "." + errorClass, this.errorContext );
		},

		resetInternals: function() {
			this.successList = [];
			this.errorList = [];
			this.errorMap = {};
			this.toShow = $( [] );
			this.toHide = $( [] );
		},

		reset: function() {
			this.resetInternals();
			this.currentElements = $( [] );
		},

		prepareForm: function() {
			this.reset();
			this.toHide = this.errors().add( this.containers );
		},

		prepareElement: function( element ) {
			this.reset();
			this.toHide = this.errorsFor( element );
		},

		elementValue: function( element ) {
			var $element = $( element ),
				type = element.type,
				isContentEditable = typeof $element.attr( "contenteditable" ) !== "undefined" && $element.attr( "contenteditable" ) !== "false",
				val, idx;

			if ( type === "radio" || type === "checkbox" ) {
				return this.findByName( element.name ).filter( ":checked" ).val();
			} else if ( type === "number" && typeof element.validity !== "undefined" ) {
				return element.validity.badInput ? "NaN" : $element.val();
			}

			if ( isContentEditable ) {
				val = $element.text();
			} else {
				val = $element.val();
			}

			if ( type === "file" ) {

				// Modern browser (chrome & safari)
				if ( val.substr( 0, 12 ) === "C:\\fakepath\\" ) {
					return val.substr( 12 );
				}

				// Legacy browsers
				// Unix-based path
				idx = val.lastIndexOf( "/" );
				if ( idx >= 0 ) {
					return val.substr( idx + 1 );
				}

				// Windows-based path
				idx = val.lastIndexOf( "\\" );
				if ( idx >= 0 ) {
					return val.substr( idx + 1 );
				}

				// Just the file name
				return val;
			}

			if ( typeof val === "string" ) {
				return val.replace( /\r/g, "" );
			}
			return val;
		},

		check: function( element ) {
			element = this.validationTargetFor( this.clean( element ) );

			var rules = $( element ).rules(),
				rulesCount = $.map( rules, function( n, i ) {
					return i;
				} ).length,
				dependencyMismatch = false,
				val = this.elementValue( element ),
				result, method, rule, normalizer;

			// Prioritize the local normalizer defined for this element over the global one
			// if the former exists, otherwise user the global one in case it exists.
			if ( typeof rules.normalizer === "function" ) {
				normalizer = rules.normalizer;
			} else if (	typeof this.settings.normalizer === "function" ) {
				normalizer = this.settings.normalizer;
			}

			// If normalizer is defined, then call it to retreive the changed value instead
			// of using the real one.
			// Note that `this` in the normalizer is `element`.
			if ( normalizer ) {
				val = normalizer.call( element, val );

				// Delete the normalizer from rules to avoid treating it as a pre-defined method.
				delete rules.normalizer;
			}

			for ( method in rules ) {
				rule = { method: method, parameters: rules[ method ] };
				try {
					result = $.validator.methods[ method ].call( this, val, element, rule.parameters );

					// If a method indicates that the field is optional and therefore valid,
					// don't mark it as valid when there are no other rules
					if ( result === "dependency-mismatch" && rulesCount === 1 ) {
						dependencyMismatch = true;
						continue;
					}
					dependencyMismatch = false;

					if ( result === "pending" ) {
						this.toHide = this.toHide.not( this.errorsFor( element ) );
						return;
					}

					if ( !result ) {
						this.formatAndAdd( element, rule );
						return false;
					}
				} catch ( e ) {
					if ( this.settings.debug && window.console ) {
						console.log( "Exception occurred when checking element " + element.id + ", check the '" + rule.method + "' method.", e );
					}
					if ( e instanceof TypeError ) {
						e.message += ".  Exception occurred when checking element " + element.id + ", check the '" + rule.method + "' method.";
					}

					throw e;
				}
			}
			if ( dependencyMismatch ) {
				return;
			}
			if ( this.objectLength( rules ) ) {
				this.successList.push( element );
			}
			return true;
		},

		// Return the custom message for the given element and validation method
		// specified in the element's HTML5 data attribute
		// return the generic message if present and no method specific message is present
		customDataMessage: function( element, method ) {
			return $( element ).data( "msg" + method.charAt( 0 ).toUpperCase() +
				method.substring( 1 ).toLowerCase() ) || $( element ).data( "msg" );
		},

		// Return the custom message for the given element name and validation method
		customMessage: function( name, method ) {
			var m = this.settings.messages[ name ];
			return m && ( m.constructor === String ? m : m[ method ] );
		},

		// Return the first defined argument, allowing empty strings
		findDefined: function() {
			for ( var i = 0; i < arguments.length; i++ ) {
				if ( arguments[ i ] !== undefined ) {
					return arguments[ i ];
				}
			}
			return undefined;
		},

		// The second parameter 'rule' used to be a string, and extended to an object literal
		// of the following form:
		// rule = {
		//     method: "method name",
		//     parameters: "the given method parameters"
		// }
		//
		// The old behavior still supported, kept to maintain backward compatibility with
		// old code, and will be removed in the next major release.
		defaultMessage: function( element, rule ) {
			if ( typeof rule === "string" ) {
				rule = { method: rule };
			}

			var message = this.findDefined(
					this.customMessage( element.name, rule.method ),
					this.customDataMessage( element, rule.method ),

					// 'title' is never undefined, so handle empty string as undefined
					!this.settings.ignoreTitle && element.title || undefined,
					$.validator.messages[ rule.method ],
					"<strong>Warning: No message defined for " + element.name + "</strong>"
				),
				theregex = /\$?\{(\d+)\}/g;
			if ( typeof message === "function" ) {
				message = message.call( this, rule.parameters, element );
			} else if ( theregex.test( message ) ) {
				message = $.validator.format( message.replace( theregex, "{$1}" ), rule.parameters );
			}

			return message;
		},

		formatAndAdd: function( element, rule ) {
			var message = this.defaultMessage( element, rule );

			this.errorList.push( {
				message: message,
				element: element,
				method: rule.method
			} );

			this.errorMap[ element.name ] = message;
			this.submitted[ element.name ] = message;
		},

		addWrapper: function( toToggle ) {
			if ( this.settings.wrapper ) {
				toToggle = toToggle.add( toToggle.parent( this.settings.wrapper ) );
			}
			return toToggle;
		},

		defaultShowErrors: function() {
			var i, elements, error;
			for ( i = 0; this.errorList[ i ]; i++ ) {
				error = this.errorList[ i ];
				if ( this.settings.highlight ) {
					this.settings.highlight.call( this, error.element, this.settings.errorClass, this.settings.validClass );
				}
				this.showLabel( error.element, error.message );
			}
			if ( this.errorList.length ) {
				this.toShow = this.toShow.add( this.containers );
			}
			if ( this.settings.success ) {
				for ( i = 0; this.successList[ i ]; i++ ) {
					this.showLabel( this.successList[ i ] );
				}
			}
			if ( this.settings.unhighlight ) {
				for ( i = 0, elements = this.validElements(); elements[ i ]; i++ ) {
					this.settings.unhighlight.call( this, elements[ i ], this.settings.errorClass, this.settings.validClass );
				}
			}
			this.toHide = this.toHide.not( this.toShow );
			this.hideErrors();
			this.addWrapper( this.toShow ).show();
		},

		validElements: function() {
			return this.currentElements.not( this.invalidElements() );
		},

		invalidElements: function() {
			return $( this.errorList ).map( function() {
				return this.element;
			} );
		},

		showLabel: function( element, message ) {
			var place, group, errorID, v,
				error = this.errorsFor( element ),
				elementID = this.idOrName( element ),
				describedBy = $( element ).attr( "aria-describedby" );

			if ( error.length ) {

				// Refresh error/success class
				error.removeClass( this.settings.validClass ).addClass( this.settings.errorClass );

				// Replace message on existing label
				error.html( message );
			} else {

				// Create error element
				error = $( "<" + this.settings.errorElement + ">" )
					.attr( "id", elementID + "-error" )
					.addClass( this.settings.errorClass )
					.html( message || "" );

				// Maintain reference to the element to be placed into the DOM
				place = error;
				if ( this.settings.wrapper ) {

					// Make sure the element is visible, even in IE
					// actually showing the wrapped element is handled elsewhere
					place = error.hide().show().wrap( "<" + this.settings.wrapper + "/>" ).parent();
				}
				if ( this.labelContainer.length ) {
					this.labelContainer.append( place );
				} else if ( this.settings.errorPlacement ) {
					this.settings.errorPlacement.call( this, place, $( element ) );
				} else {
					place.insertAfter( element );
				}

				// Link error back to the element
				if ( error.is( "label" ) ) {

					// If the error is a label, then associate using 'for'
					error.attr( "for", elementID );

					// If the element is not a child of an associated label, then it's necessary
					// to explicitly apply aria-describedby
				} else if ( error.parents( "label[for='" + this.escapeCssMeta( elementID ) + "']" ).length === 0 ) {
					errorID = error.attr( "id" );

					// Respect existing non-error aria-describedby
					if ( !describedBy ) {
						describedBy = errorID;
					} else if ( !describedBy.match( new RegExp( "\\b" + this.escapeCssMeta( errorID ) + "\\b" ) ) ) {

						// Add to end of list if not already present
						describedBy += " " + errorID;
					}
					$( element ).attr( "aria-describedby", describedBy );

					// If this element is grouped, then assign to all elements in the same group
					group = this.groups[ element.name ];
					if ( group ) {
						v = this;
						$.each( v.groups, function( name, testgroup ) {
							if ( testgroup === group ) {
								$( "[name='" + v.escapeCssMeta( name ) + "']", v.currentForm )
									.attr( "aria-describedby", error.attr( "id" ) );
							}
						} );
					}
				}
			}
			if ( !message && this.settings.success ) {
				error.text( "" );
				if ( typeof this.settings.success === "string" ) {
					error.addClass( this.settings.success );
				} else {
					this.settings.success( error, element );
				}
			}
			this.toShow = this.toShow.add( error );
		},

		errorsFor: function( element ) {
			var name = this.escapeCssMeta( this.idOrName( element ) ),
				describer = $( element ).attr( "aria-describedby" ),
				selector = "label[for='" + name + "'], label[for='" + name + "'] *";

			// 'aria-describedby' should directly reference the error element
			if ( describer ) {
				selector = selector + ", #" + this.escapeCssMeta( describer )
					.replace( /\s+/g, ", #" );
			}

			return this
				.errors()
				.filter( selector );
		},

		// See https://api.jquery.com/category/selectors/, for CSS
		// meta-characters that should be escaped in order to be used with JQuery
		// as a literal part of a name/id or any selector.
		escapeCssMeta: function( string ) {
			return string.replace( /([\\!"#$%&'()*+,./:;<=>?@\[\]^`{|}~])/g, "\\$1" );
		},

		idOrName: function( element ) {
			return this.groups[ element.name ] || ( this.checkable( element ) ? element.name : element.id || element.name );
		},

		validationTargetFor: function( element ) {

			// If radio/checkbox, validate first element in group instead
			if ( this.checkable( element ) ) {
				element = this.findByName( element.name );
			}

			// Always apply ignore filter
			return $( element ).not( this.settings.ignore )[ 0 ];
		},

		checkable: function( element ) {
			return ( /radio|checkbox/i ).test( element.type );
		},

		findByName: function( name ) {
			return $( this.currentForm ).find( "[name='" + this.escapeCssMeta( name ) + "']" );
		},

		getLength: function( value, element ) {
			switch ( element.nodeName.toLowerCase() ) {
			case "select":
				return $( "option:selected", element ).length;
			case "input":
				if ( this.checkable( element ) ) {
					return this.findByName( element.name ).filter( ":checked" ).length;
				}
			}
			return value.length;
		},

		depend: function( param, element ) {
			return this.dependTypes[ typeof param ] ? this.dependTypes[ typeof param ]( param, element ) : true;
		},

		dependTypes: {
			"boolean": function( param ) {
				return param;
			},
			"string": function( param, element ) {
				return !!$( param, element.form ).length;
			},
			"function": function( param, element ) {
				return param( element );
			}
		},

		optional: function( element ) {
			var val = this.elementValue( element );
			return !$.validator.methods.required.call( this, val, element ) && "dependency-mismatch";
		},

		startRequest: function( element ) {
			if ( !this.pending[ element.name ] ) {
				this.pendingRequest++;
				$( element ).addClass( this.settings.pendingClass );
				this.pending[ element.name ] = true;
			}
		},

		stopRequest: function( element, valid ) {
			this.pendingRequest--;

			// Sometimes synchronization fails, make sure pendingRequest is never < 0
			if ( this.pendingRequest < 0 ) {
				this.pendingRequest = 0;
			}
			delete this.pending[ element.name ];
			$( element ).removeClass( this.settings.pendingClass );
			if ( valid && this.pendingRequest === 0 && this.formSubmitted && this.form() ) {
				$( this.currentForm ).submit();

				// Remove the hidden input that was used as a replacement for the
				// missing submit button. The hidden input is added by `handle()`
				// to ensure that the value of the used submit button is passed on
				// for scripted submits triggered by this method
				if ( this.submitButton ) {
					$( "input:hidden[name='" + this.submitButton.name + "']", this.currentForm ).remove();
				}

				this.formSubmitted = false;
			} else if ( !valid && this.pendingRequest === 0 && this.formSubmitted ) {
				$( this.currentForm ).triggerHandler( "invalid-form", [ this ] );
				this.formSubmitted = false;
			}
		},

		previousValue: function( element, method ) {
			method = typeof method === "string" && method || "remote";

			return $.data( element, "previousValue" ) || $.data( element, "previousValue", {
				old: null,
				valid: true,
				message: this.defaultMessage( element, { method: method } )
			} );
		},

		// Cleans up all forms and elements, removes validator-specific events
		destroy: function() {
			this.resetForm();

			$( this.currentForm )
				.off( ".validate" )
				.removeData( "validator" )
				.find( ".validate-equalTo-blur" )
					.off( ".validate-equalTo" )
					.removeClass( "validate-equalTo-blur" )
				.find( ".validate-lessThan-blur" )
					.off( ".validate-lessThan" )
					.removeClass( "validate-lessThan-blur" )
				.find( ".validate-lessThanEqual-blur" )
					.off( ".validate-lessThanEqual" )
					.removeClass( "validate-lessThanEqual-blur" )
				.find( ".validate-greaterThanEqual-blur" )
					.off( ".validate-greaterThanEqual" )
					.removeClass( "validate-greaterThanEqual-blur" )
				.find( ".validate-greaterThan-blur" )
					.off( ".validate-greaterThan" )
					.removeClass( "validate-greaterThan-blur" );
		}

	},

	classRuleSettings: {
		required: { required: true },
		email: { email: true },
		url: { url: true },
		date: { date: true },
		dateISO: { dateISO: true },
		number: { number: true },
		digits: { digits: true },
		creditcard: { creditcard: true }
	},

	addClassRules: function( className, rules ) {
		if ( className.constructor === String ) {
			this.classRuleSettings[ className ] = rules;
		} else {
			$.extend( this.classRuleSettings, className );
		}
	},

	classRules: function( element ) {
		var rules = {},
			classes = $( element ).attr( "class" );

		if ( classes ) {
			$.each( classes.split( " " ), function() {
				if ( this in $.validator.classRuleSettings ) {
					$.extend( rules, $.validator.classRuleSettings[ this ] );
				}
			} );
		}
		return rules;
	},

	normalizeAttributeRule: function( rules, type, method, value ) {

		// Convert the value to a number for number inputs, and for text for backwards compability
		// allows type="date" and others to be compared as strings
		if ( /min|max|step/.test( method ) && ( type === null || /number|range|text/.test( type ) ) ) {
			value = Number( value );

			// Support Opera Mini, which returns NaN for undefined minlength
			if ( isNaN( value ) ) {
				value = undefined;
			}
		}

		if ( value || value === 0 ) {
			rules[ method ] = value;
		} else if ( type === method && type !== "range" ) {

			// Exception: the jquery validate 'range' method
			// does not test for the html5 'range' type
			rules[ method ] = true;
		}
	},

	attributeRules: function( element ) {
		var rules = {},
			$element = $( element ),
			type = element.getAttribute( "type" ),
			method, value;

		for ( method in $.validator.methods ) {

			// Support for <input required> in both html5 and older browsers
			if ( method === "required" ) {
				value = element.getAttribute( method );

				// Some browsers return an empty string for the required attribute
				// and non-HTML5 browsers might have required="" markup
				if ( value === "" ) {
					value = true;
				}

				// Force non-HTML5 browsers to return bool
				value = !!value;
			} else {
				value = $element.attr( method );
			}

			this.normalizeAttributeRule( rules, type, method, value );
		}

		// 'maxlength' may be returned as -1, 2147483647 ( IE ) and 524288 ( safari ) for text inputs
		if ( rules.maxlength && /-1|2147483647|524288/.test( rules.maxlength ) ) {
			delete rules.maxlength;
		}

		return rules;
	},

	dataRules: function( element ) {
		var rules = {},
			$element = $( element ),
			type = element.getAttribute( "type" ),
			method, value;

		for ( method in $.validator.methods ) {
			value = $element.data( "rule" + method.charAt( 0 ).toUpperCase() + method.substring( 1 ).toLowerCase() );

			// Cast empty attributes like `data-rule-required` to `true`
			if ( value === "" ) {
				value = true;
			}

			this.normalizeAttributeRule( rules, type, method, value );
		}
		return rules;
	},

	staticRules: function( element ) {
		var rules = {},
			validator = $.data( element.form, "validator" );

		if ( validator.settings.rules ) {
			rules = $.validator.normalizeRule( validator.settings.rules[ element.name ] ) || {};
		}
		return rules;
	},

	normalizeRules: function( rules, element ) {

		// Handle dependency check
		$.each( rules, function( prop, val ) {

			// Ignore rule when param is explicitly false, eg. required:false
			if ( val === false ) {
				delete rules[ prop ];
				return;
			}
			if ( val.param || val.depends ) {
				var keepRule = true;
				switch ( typeof val.depends ) {
				case "string":
					keepRule = !!$( val.depends, element.form ).length;
					break;
				case "function":
					keepRule = val.depends.call( element, element );
					break;
				}
				if ( keepRule ) {
					rules[ prop ] = val.param !== undefined ? val.param : true;
				} else {
					$.data( element.form, "validator" ).resetElements( $( element ) );
					delete rules[ prop ];
				}
			}
		} );

		// Evaluate parameters
		$.each( rules, function( rule, parameter ) {
			rules[ rule ] = typeof parameter === "function" && rule !== "normalizer" ? parameter( element ) : parameter;
		} );

		// Clean number parameters
		$.each( [ "minlength", "maxlength" ], function() {
			if ( rules[ this ] ) {
				rules[ this ] = Number( rules[ this ] );
			}
		} );
		$.each( [ "rangelength", "range" ], function() {
			var parts;
			if ( rules[ this ] ) {
				if ( Array.isArray( rules[ this ] ) ) {
					rules[ this ] = [ Number( rules[ this ][ 0 ] ), Number( rules[ this ][ 1 ] ) ];
				} else if ( typeof rules[ this ] === "string" ) {
					parts = rules[ this ].replace( /[\[\]]/g, "" ).split( /[\s,]+/ );
					rules[ this ] = [ Number( parts[ 0 ] ), Number( parts[ 1 ] ) ];
				}
			}
		} );

		if ( $.validator.autoCreateRanges ) {

			// Auto-create ranges
			if ( rules.min != null && rules.max != null ) {
				rules.range = [ rules.min, rules.max ];
				delete rules.min;
				delete rules.max;
			}
			if ( rules.minlength != null && rules.maxlength != null ) {
				rules.rangelength = [ rules.minlength, rules.maxlength ];
				delete rules.minlength;
				delete rules.maxlength;
			}
		}

		return rules;
	},

	// Converts a simple string to a {string: true} rule, e.g., "required" to {required:true}
	normalizeRule: function( data ) {
		if ( typeof data === "string" ) {
			var transformed = {};
			$.each( data.split( /\s/ ), function() {
				transformed[ this ] = true;
			} );
			data = transformed;
		}
		return data;
	},

	// https://jqueryvalidation.org/jQuery.validator.addMethod/
	addMethod: function( name, method, message ) {
		$.validator.methods[ name ] = method;
		$.validator.messages[ name ] = message !== undefined ? message : $.validator.messages[ name ];
		if ( method.length < 3 ) {
			$.validator.addClassRules( name, $.validator.normalizeRule( name ) );
		}
	},

	// https://jqueryvalidation.org/jQuery.validator.methods/
	methods: {

		// https://jqueryvalidation.org/required-method/
		required: function( value, element, param ) {

			// Check if dependency is met
			if ( !this.depend( param, element ) ) {
				return "dependency-mismatch";
			}
			if ( element.nodeName.toLowerCase() === "select" ) {

				// Could be an array for select-multiple or a string, both are fine this way
				var val = $( element ).val();
				return val && val.length > 0;
			}
			if ( this.checkable( element ) ) {
				return this.getLength( value, element ) > 0;
			}
			return value !== undefined && value !== null && value.length > 0;
		},

		// https://jqueryvalidation.org/email-method/
		email: function( value, element ) {

			// From https://html.spec.whatwg.org/multipage/forms.html#valid-e-mail-address
			// Retrieved 2014-01-14
			// If you have a problem with this implementation, report a bug against the above spec
			// Or use custom methods to implement your own email validation
			return this.optional( element ) || /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test( value );
		},

		// https://jqueryvalidation.org/url-method/
		url: function( value, element ) {

			// Copyright (c) 2010-2013 Diego Perini, MIT licensed
			// https://gist.github.com/dperini/729294
			// see also https://mathiasbynens.be/demo/url-regex
			// modified to allow protocol-relative URLs
			return this.optional( element ) || /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test( value );
		},

		// https://jqueryvalidation.org/date-method/
		date: ( function() {
			var called = false;

			return function( value, element ) {
				if ( !called ) {
					called = true;
					if ( this.settings.debug && window.console ) {
						console.warn(
							"The `date` method is deprecated and will be removed in version '2.0.0'.\n" +
							"Please don't use it, since it relies on the Date constructor, which\n" +
							"behaves very differently across browsers and locales. Use `dateISO`\n" +
							"instead or one of the locale specific methods in `localizations/`\n" +
							"and `additional-methods.js`."
						);
					}
				}

				return this.optional( element ) || !/Invalid|NaN/.test( new Date( value ).toString() );
			};
		}() ),

		// https://jqueryvalidation.org/dateISO-method/
		dateISO: function( value, element ) {
			return this.optional( element ) || /^\d{4}[\/\-](0?[1-9]|1[012])[\/\-](0?[1-9]|[12][0-9]|3[01])$/.test( value );
		},

		// https://jqueryvalidation.org/number-method/
		number: function( value, element ) {
			return this.optional( element ) || /^(?:-?\d+|-?\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test( value );
		},

		// https://jqueryvalidation.org/digits-method/
		digits: function( value, element ) {
			return this.optional( element ) || /^\d+$/.test( value );
		},

		// https://jqueryvalidation.org/minlength-method/
		minlength: function( value, element, param ) {
			var length = Array.isArray( value ) ? value.length : this.getLength( value, element );
			return this.optional( element ) || length >= param;
		},

		// https://jqueryvalidation.org/maxlength-method/
		maxlength: function( value, element, param ) {
			var length = Array.isArray( value ) ? value.length : this.getLength( value, element );
			return this.optional( element ) || length <= param;
		},

		// https://jqueryvalidation.org/rangelength-method/
		rangelength: function( value, element, param ) {
			var length = Array.isArray( value ) ? value.length : this.getLength( value, element );
			return this.optional( element ) || ( length >= param[ 0 ] && length <= param[ 1 ] );
		},

		// https://jqueryvalidation.org/min-method/
		min: function( value, element, param ) {
			return this.optional( element ) || value >= param;
		},

		// https://jqueryvalidation.org/max-method/
		max: function( value, element, param ) {
			return this.optional( element ) || value <= param;
		},

		// https://jqueryvalidation.org/range-method/
		range: function( value, element, param ) {
			return this.optional( element ) || ( value >= param[ 0 ] && value <= param[ 1 ] );
		},

		// https://jqueryvalidation.org/step-method/
		step: function( value, element, param ) {
			var type = $( element ).attr( "type" ),
				errorMessage = "Step attribute on input type " + type + " is not supported.",
				supportedTypes = [ "text", "number", "range" ],
				re = new RegExp( "\\b" + type + "\\b" ),
				notSupported = type && !re.test( supportedTypes.join() ),
				decimalPlaces = function( num ) {
					var match = ( "" + num ).match( /(?:\.(\d+))?$/ );
					if ( !match ) {
						return 0;
					}

					// Number of digits right of decimal point.
					return match[ 1 ] ? match[ 1 ].length : 0;
				},
				toInt = function( num ) {
					return Math.round( num * Math.pow( 10, decimals ) );
				},
				valid = true,
				decimals;

			// Works only for text, number and range input types
			// TODO find a way to support input types date, datetime, datetime-local, month, time and week
			if ( notSupported ) {
				throw new Error( errorMessage );
			}

			decimals = decimalPlaces( param );

			// Value can't have too many decimals
			if ( decimalPlaces( value ) > decimals || toInt( value ) % toInt( param ) !== 0 ) {
				valid = false;
			}

			return this.optional( element ) || valid;
		},

		// https://jqueryvalidation.org/equalTo-method/
		equalTo: function( value, element, param ) {

			// Bind to the blur event of the target in order to revalidate whenever the target field is updated
			var target = $( param );
			if ( this.settings.onfocusout && target.not( ".validate-equalTo-blur" ).length ) {
				target.addClass( "validate-equalTo-blur" ).on( "blur.validate-equalTo", function() {
					$( element ).valid();
				} );
			}
			return value === target.val();
		},

		// https://jqueryvalidation.org/remote-method/
		remote: function( value, element, param, method ) {
			if ( this.optional( element ) ) {
				return "dependency-mismatch";
			}

			method = typeof method === "string" && method || "remote";

			var previous = this.previousValue( element, method ),
				validator, data, optionDataString;

			if ( !this.settings.messages[ element.name ] ) {
				this.settings.messages[ element.name ] = {};
			}
			previous.originalMessage = previous.originalMessage || this.settings.messages[ element.name ][ method ];
			this.settings.messages[ element.name ][ method ] = previous.message;

			param = typeof param === "string" && { url: param } || param;
			optionDataString = $.param( $.extend( { data: value }, param.data ) );
			if ( previous.old === optionDataString ) {
				return previous.valid;
			}

			previous.old = optionDataString;
			validator = this;
			this.startRequest( element );
			data = {};
			data[ element.name ] = value;
			$.ajax( $.extend( true, {
				mode: "abort",
				port: "validate" + element.name,
				dataType: "json",
				data: data,
				context: validator.currentForm,
				success: function( response ) {
					var valid = response === true || response === "true",
						errors, message, submitted;

					validator.settings.messages[ element.name ][ method ] = previous.originalMessage;
					if ( valid ) {
						submitted = validator.formSubmitted;
						validator.resetInternals();
						validator.toHide = validator.errorsFor( element );
						validator.formSubmitted = submitted;
						validator.successList.push( element );
						validator.invalid[ element.name ] = false;
						validator.showErrors();
					} else {
						errors = {};
						message = response || validator.defaultMessage( element, { method: method, parameters: value } );
						errors[ element.name ] = previous.message = message;
						validator.invalid[ element.name ] = true;
						validator.showErrors( errors );
					}
					previous.valid = valid;
					validator.stopRequest( element, valid );
				}
			}, param ) );
			return "pending";
		}
	}

} );

// Ajax mode: abort
// usage: $.ajax({ mode: "abort"[, port: "uniqueport"]});
// if mode:"abort" is used, the previous request on that port (port can be undefined) is aborted via XMLHttpRequest.abort()

var pendingRequests = {},
	ajax;

// Use a prefilter if available (1.5+)
if ( $.ajaxPrefilter ) {
	$.ajaxPrefilter( function( settings, _, xhr ) {
		var port = settings.port;
		if ( settings.mode === "abort" ) {
			if ( pendingRequests[ port ] ) {
				pendingRequests[ port ].abort();
			}
			pendingRequests[ port ] = xhr;
		}
	} );
} else {

	// Proxy ajax
	ajax = $.ajax;
	$.ajax = function( settings ) {
		var mode = ( "mode" in settings ? settings : $.ajaxSettings ).mode,
			port = ( "port" in settings ? settings : $.ajaxSettings ).port;
		if ( mode === "abort" ) {
			if ( pendingRequests[ port ] ) {
				pendingRequests[ port ].abort();
			}
			pendingRequests[ port ] = ajax.apply( this, arguments );
			return pendingRequests[ port ];
		}
		return ajax.apply( this, arguments );
	};
}
return $;
}));
!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.AirDatepicker=t():e.AirDatepicker=t()}(this,(function(){return function(){"use strict";var e={d:function(t,i){for(var s in i)e.o(i,s)&&!e.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:i[s]})},o:function(e,t){return Object.prototype.hasOwnProperty.call(e,t)}},t={};e.d(t,{default:function(){return B}});var i={days:"days",months:"months",years:"years",day:"day",month:"month",year:"year",eventChangeViewDate:"changeViewDate",eventChangeCurrentView:"changeCurrentView",eventChangeFocusDate:"changeFocusDate",eventChangeSelectedDate:"changeSelectedDate",eventChangeTime:"changeTime",eventChangeLastSelectedDate:"changeLastSelectedDate",actionSelectDate:"selectDate",actionUnselectDate:"unselectDate",cssClassWeekend:"-weekend-"},s={classes:"",inline:!1,locale:{days:["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"],daysShort:["Вос","Пон","Вто","Сре","Чет","Пят","Суб"],daysMin:["Вс","Пн","Вт","Ср","Чт","Пт","Сб"],months:["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],monthsShort:["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"],today:"Сегодня",clear:"Очистить",dateFormat:"dd.MM.yyyy",timeFormat:"HH:mm",firstDay:1},startDate:new Date,firstDay:"",weekends:[6,0],dateFormat:"",altField:"",altFieldDateFormat:"T",toggleSelected:!0,keyboardNav:!0,selectedDates:!1,container:"",isMobile:!1,visible:!1,position:"bottom left",offset:12,view:i.days,minView:i.days,showOtherMonths:!0,selectOtherMonths:!0,moveToOtherMonthsOnSelect:!0,showOtherYears:!0,selectOtherYears:!0,moveToOtherYearsOnSelect:!0,minDate:"",maxDate:"",disableNavWhenOutOfRange:!0,multipleDates:!1,multipleDatesSeparator:", ",range:!1,dynamicRange:!0,buttons:!1,monthsField:"monthsShort",showEvent:"focus",autoClose:!1,prevHtml:'<svg><path d="M 17,12 l -5,5 l 5,5"></path></svg>',nextHtml:'<svg><path d="M 14,12 l 5,5 l -5,5"></path></svg>',navTitles:{days:"MMMM, <i>yyyy</i>",months:"yyyy",years:"yyyy1 - yyyy2"},timepicker:!1,onlyTimepicker:!1,dateTimeSeparator:" ",timeFormat:"",minHours:0,maxHours:24,minMinutes:0,maxMinutes:59,hoursStep:1,minutesStep:1,onSelect:!1,onChangeViewDate:!1,onChangeView:!1,onRenderCell:!1,onShow:!1,onHide:!1,onClickDayName:!1};function a(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:document;return"string"==typeof e?t.querySelector(e):e}function n(){let{tagName:e="div",className:t="",innerHtml:i="",id:s="",attrs:a={}}=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=document.createElement(e);return t&&n.classList.add(...t.split(" ")),s&&(n.id=s),i&&(n.innerHTML=i),a&&r(n,a),n}function r(e,t){for(let[i,s]of Object.entries(t))void 0!==s&&e.setAttribute(i,s);return e}function h(e){return new Date(e.getFullYear(),e.getMonth()+1,0).getDate()}function o(e){let t=e.getHours(),{hours:i,dayPeriod:s}=l(t);return{year:e.getFullYear(),month:e.getMonth(),fullMonth:e.getMonth()+1<10?"0"+(e.getMonth()+1):e.getMonth()+1,date:e.getDate(),fullDate:e.getDate()<10?"0"+e.getDate():e.getDate(),day:e.getDay(),hours:t,fullHours:d(t),hours12:i,dayPeriod:s,fullHours12:d(i),minutes:e.getMinutes(),fullMinutes:e.getMinutes()<10?"0"+e.getMinutes():e.getMinutes()}}function l(e){return{dayPeriod:e>11?"pm":"am",hours:e%12==0?12:e%12}}function d(e){return e<10?"0"+e:e}function c(e){let t=10*Math.floor(e.getFullYear()/10);return[t,t+9]}function u(){let e=[];for(var t=arguments.length,i=new Array(t),s=0;s<t;s++)i[s]=arguments[s];return i.forEach((t=>{if("object"==typeof t)for(let i in t)t[i]&&e.push(i);else t&&e.push(t)})),e.join(" ")}function p(e,t){let s=arguments.length>2&&void 0!==arguments[2]?arguments[2]:i.days;if(!e||!t)return!1;let a=o(e),n=o(t);return{[i.days]:a.date===n.date&&a.month===n.month&&a.year===n.year,[i.months]:a.month===n.month&&a.year===n.year,[i.years]:a.year===n.year}[s]}function m(e,t,i){let s=g(e,!1).getTime(),a=g(t,!1).getTime();return i?s>=a:s>a}function v(e,t){return!m(e,t,!0)}function g(e){let t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],i=new Date(e.getTime());return"boolean"!=typeof t||t||function(e){e.setHours(0,0,0,0)}(i),i}function D(e,t,i){e.length?e.forEach((e=>{e.addEventListener(t,i)})):e.addEventListener(t,i)}function y(e,t){return!(!e||e===document||e instanceof DocumentFragment)&&(e.matches(t)?e:y(e.parentNode,t))}function f(e,t,i){return e>i?i:e<t?t:e}function w(e){for(var t=arguments.length,i=new Array(t>1?t-1:0),s=1;s<t;s++)i[s-1]=arguments[s];return i.filter((e=>e)).forEach((t=>{for(let[i,s]of Object.entries(t))if(void 0!==s&&"[object Object]"===s.toString()){let t=void 0!==e[i]?e[i].toString():void 0,a=s.toString(),n=Array.isArray(s)?[]:{};e[i]=e[i]?t!==a?n:e[i]:n,w(e[i],s)}else e[i]=s})),e}function b(e){let t=e;return e instanceof Date||(t=new Date(e)),isNaN(t.getTime())&&(console.log(`Unable to convert value "${e}" to Date object`),t=!1),t}function k(e){let t="\\s|\\.|-|/|\\\\|,|\\$|\\!|\\?|:|;";return new RegExp("(^|>|"+t+")("+e+")($|<|"+t+")","g")}function $(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}class C{constructor(){let{type:e,date:t,dp:i,opts:s,body:a}=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};$(this,"focus",(()=>{this.$cell.classList.add("-focus-"),this.focused=!0})),$(this,"removeFocus",(()=>{this.$cell.classList.remove("-focus-"),this.focused=!1})),$(this,"select",(()=>{this.$cell.classList.add("-selected-"),this.selected=!0})),$(this,"removeSelect",(()=>{this.$cell.classList.remove("-selected-","-range-from-","-range-to-"),this.selected=!1})),$(this,"onChangeSelectedDate",(()=>{this.isDisabled||(this._handleSelectedStatus(),this.opts.range&&this._handleRangeStatus())})),$(this,"onChangeFocusDate",(e=>{if(!e)return void(this.focused&&this.removeFocus());let t=p(e,this.date,this.type);t?this.focus():!t&&this.focused&&this.removeFocus(),this.opts.range&&this._handleRangeStatus()})),$(this,"render",(()=>(this.$cell.innerHTML=this._getHtml(),this.$cell.adpCell=this,this.$cell))),this.type=e,this.singleType=this.type.slice(0,-1),this.date=t,this.dp=i,this.opts=s,this.body=a,this.customData=!1,this.init()}init(){let{range:e,onRenderCell:t}=this.opts;t&&(this.customData=t({date:this.date,cellType:this.singleType,datepicker:this.dp})),this._createElement(),this._bindDatepickerEvents(),this._handleInitialFocusStatus(),this.dp.hasSelectedDates&&(this._handleSelectedStatus(),e&&this._handleRangeStatus())}_bindDatepickerEvents(){this.dp.on(i.eventChangeSelectedDate,this.onChangeSelectedDate),this.dp.on(i.eventChangeFocusDate,this.onChangeFocusDate)}unbindDatepickerEvents(){this.dp.off(i.eventChangeSelectedDate,this.onChangeSelectedDate),this.dp.off(i.eventChangeFocusDate,this.onChangeFocusDate)}_createElement(){var e;let{year:t,month:i,date:s}=o(this.date),a=(null===(e=this.customData)||void 0===e?void 0:e.attrs)||{};this.$cell=n({className:this._getClassName(),attrs:{"data-year":t,"data-month":i,"data-date":s,...a}})}_getClassName(){var e,t;let s=new Date,{selectOtherMonths:a,selectOtherYears:n}=this.opts,{minDate:r,maxDate:h}=this.dp,{day:l}=o(this.date),d=this._isOutOfMinMaxRange(),c=null===(e=this.customData)||void 0===e?void 0:e.disabled,m=u("air-datepicker-cell",`-${this.singleType}-`,{"-current-":p(s,this.date,this.type),"-min-date-":r&&p(r,this.date,this.type),"-max-date-":h&&p(h,this.date,this.type)}),v="";switch(this.type){case i.days:v=u({"-weekend-":this.dp.isWeekend(l),"-other-month-":this.isOtherMonth,"-disabled-":this.isOtherMonth&&!a||d||c});break;case i.months:v=u({"-disabled-":d||c});break;case i.years:v=u({"-other-decade-":this.isOtherDecade,"-disabled-":d||this.isOtherDecade&&!n||c})}return u(m,v,null===(t=this.customData)||void 0===t?void 0:t.classes)}_getHtml(){var e;let{year:t,month:s,date:a}=o(this.date),{showOtherMonths:n,showOtherYears:r}=this.opts;if(null!==(e=this.customData)&&void 0!==e&&e.html)return this.customData.html;switch(this.type){case i.days:return!n&&this.isOtherMonth?"":a;case i.months:return this.dp.locale[this.opts.monthsField][s];case i.years:return!r&&this.isOtherDecade?"":t}}_isOutOfMinMaxRange(){let{minDate:e,maxDate:t}=this.dp,{type:s,date:a}=this,{month:n,year:r,date:h}=o(a),l=s===i.days,d=s===i.years,c=!!e&&new Date(r,d?e.getMonth():n,l?h:e.getDate()),u=!!t&&new Date(r,d?t.getMonth():n,l?h:t.getDate());return e&&t?v(c,e)||m(u,t):e?v(c,e):t?m(u,t):void 0}destroy(){this.unbindDatepickerEvents()}_handleRangeStatus(){let{rangeDateFrom:e,rangeDateTo:t}=this.dp,i=u({"-in-range-":e&&t&&(s=this.date,a=e,n=t,m(s,a)&&v(s,n)),"-range-from-":e&&p(this.date,e,this.type),"-range-to-":t&&p(this.date,t,this.type)});var s,a,n;this.$cell.classList.remove("-range-from-","-range-to-","-in-range-"),i&&this.$cell.classList.add(...i.split(" "))}_handleSelectedStatus(){let e=this.dp._checkIfDateIsSelected(this.date,this.type);e?this.select():!e&&this.selected&&this.removeSelect()}_handleInitialFocusStatus(){p(this.dp.focusDate,this.date,this.type)&&this.focus()}get isDisabled(){return this.$cell.matches(".-disabled-")}get isOtherMonth(){return this.dp.isOtherMonth(this.date)}get isOtherDecade(){return this.dp.isOtherDecade(this.date)}}function _(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}let M={[i.days]:`<div class="air-datepicker-body--day-names"></div><div class="air-datepicker-body--cells -${i.days}-"></div>`,[i.months]:`<div class="air-datepicker-body--cells -${i.months}-"></div>`,[i.years]:`<div class="air-datepicker-body--cells -${i.years}-"></div>`};const S=".air-datepicker-cell";class T{constructor(e){let{dp:t,type:s,opts:a}=e;_(this,"handleClick",(e=>{let t=e.target.closest(S).adpCell;if(t.isDisabled)return;if(!this.dp.isMinViewReached)return void this.dp.down();let i=this.dp._checkIfDateIsSelected(t.date,t.type);i?this.dp._handleAlreadySelectedDates(i,t.date):this.dp.selectDate(t.date)})),_(this,"handleDayNameClick",(e=>{let t=e.target.getAttribute("data-day-index");this.opts.onClickDayName({dayIndex:Number(t),datepicker:this.dp})})),_(this,"onChangeCurrentView",(e=>{e!==this.type?this.hide():(this.show(),this.render())})),_(this,"onMouseOverCell",(e=>{let t=y(e.target,S);this.dp.setFocusDate(!!t&&t.adpCell.date)})),_(this,"onMouseOutCell",(()=>{this.dp.setFocusDate(!1)})),_(this,"onClickBody",(e=>{let{onClickDayName:t}=this.opts,i=e.target;i.closest(S)&&this.handleClick(e),t&&i.closest(".air-datepicker-body--day-name")&&this.handleDayNameClick(e)})),_(this,"onMouseDown",(e=>{this.pressed=!0;let t=y(e.target,S),i=t&&t.adpCell;p(i.date,this.dp.rangeDateFrom)&&(this.rangeFromFocused=!0),p(i.date,this.dp.rangeDateTo)&&(this.rangeToFocused=!0)})),_(this,"onMouseMove",(e=>{if(!this.pressed||!this.dp.isMinViewReached)return;e.preventDefault();let t=y(e.target,S),i=t&&t.adpCell,{selectedDates:s,rangeDateTo:a,rangeDateFrom:n}=this.dp;if(!i||i.isDisabled)return;let{date:r}=i;if(2===s.length){if(this.rangeFromFocused&&!m(r,a)){let{hours:e,minutes:t}=o(n);r.setHours(e),r.setMinutes(t),this.dp.rangeDateFrom=r,this.dp.replaceDate(n,r)}if(this.rangeToFocused&&!v(r,n)){let{hours:e,minutes:t}=o(a);r.setHours(e),r.setMinutes(t),this.dp.rangeDateTo=r,this.dp.replaceDate(a,r)}}})),_(this,"onMouseUp",(()=>{this.pressed=!1,this.rangeFromFocused=!1,this.rangeToFocused=!1})),_(this,"onChangeViewDate",((e,t)=>{if(!this.isVisible)return;let s=c(e),a=c(t);switch(this.dp.currentView){case i.days:if(p(e,t,i.months))return;break;case i.months:if(p(e,t,i.years))return;break;case i.years:if(s[0]===a[0]&&s[1]===a[1])return}this.render()})),_(this,"render",(()=>{this.destroyCells(),this._generateCells(),this.cells.forEach((e=>{this.$cells.appendChild(e.render())}))})),this.dp=t,this.type=s,this.opts=a,this.cells=[],this.$el="",this.pressed=!1,this.isVisible=!0,this.init()}init(){this._buildBaseHtml(),this.type===i.days&&this.renderDayNames(),this.render(),this._bindEvents(),this._bindDatepickerEvents()}_bindEvents(){let{range:e,dynamicRange:t}=this.opts;D(this.$el,"mouseover",this.onMouseOverCell),D(this.$el,"mouseout",this.onMouseOutCell),D(this.$el,"click",this.onClickBody),e&&t&&(D(this.$el,"mousedown",this.onMouseDown),D(this.$el,"mousemove",this.onMouseMove),D(window.document,"mouseup",this.onMouseUp))}_bindDatepickerEvents(){this.dp.on(i.eventChangeViewDate,this.onChangeViewDate),this.dp.on(i.eventChangeCurrentView,this.onChangeCurrentView)}_buildBaseHtml(){this.$el=n({className:`air-datepicker-body -${this.type}-`,innerHtml:M[this.type]}),this.$names=a(".air-datepicker-body--day-names",this.$el),this.$cells=a(".air-datepicker-body--cells",this.$el)}_getDayNamesHtml(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.dp.locale.firstDay,t="",s=this.dp.isWeekend,{onClickDayName:a}=this.opts,n=e,r=0;for(;r<7;){let e=n%7;t+=`<div class="${u("air-datepicker-body--day-name",{[i.cssClassWeekend]:s(e),"-clickable-":!!a})}" data-day-index='${e}'>${this.dp.locale.daysMin[e]}</div>`,r++,n++}return t}renderDayNames(){this.$names.innerHTML=this._getDayNamesHtml()}_generateCell(e){let{type:t,dp:i,opts:s}=this;return new C({type:t,dp:i,opts:s,date:e,body:this})}_generateCells(){T.getDatesFunction(this.type)(this.dp,(e=>{this.cells.push(this._generateCell(e))}))}show(){this.isVisible=!0,this.$el.classList.remove("-hidden-")}hide(){this.isVisible=!1,this.$el.classList.add("-hidden-")}destroyCells(){this.cells.forEach((e=>e.destroy())),this.cells=[],this.$cells.innerHTML=""}destroy(){this.destroyCells(),this.dp.off(i.eventChangeViewDate,this.onChangeViewDate),this.dp.off(i.eventChangeCurrentView,this.onChangeCurrentView)}static getDaysDates(e,t){let{viewDate:i,locale:{firstDay:s}}=e,a=h(i),{year:n,month:r}=o(i),l=new Date(n,r,1),d=new Date(n,r,a),c=l.getDay()-s,u=6-d.getDay()+s;c=c<0?c+7:c,u=u>6?u-7:u;let p=function(e,t){let{year:i,month:s,date:a}=o(e);return new Date(i,s,a-t)}(l,c),m=a+c+u,v=p.getDate(),{year:g,month:D}=o(p),y=0;const f=[];for(;y<m;){let e=new Date(g,D,v+y);t&&t(e),f.push(e),y++}return f}static getMonthsDates(e,t){let{year:i}=e.parsedViewDate,s=0,a=[];for(;s<12;){const e=new Date(i,s);a.push(e),t&&t(e),s++}return a}static getYearsDates(e,t){let i=c(e.viewDate),s=i[0]-1,a=i[1]+1,n=s,r=[];for(;n<=a;){const e=new Date(n,0);r.push(e),t&&t(e),n++}return r}static getDatesFunction(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:i.days;return{[i.days]:T.getDaysDates,[i.months]:T.getMonthsDates,[i.years]:T.getYearsDates}[e]}}function F(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}class V{constructor(e){let{dp:t,opts:i}=e;F(this,"onClickNav",(e=>{let t=y(e.target,".air-datepicker-nav--action");if(!t)return;let i=t.dataset.action;this.dp[i]()})),F(this,"onChangeViewDate",(()=>{this.render(),this._resetNavStatus(),this.handleNavStatus()})),F(this,"onChangeCurrentView",(()=>{this.render(),this._resetNavStatus(),this.handleNavStatus()})),F(this,"onClickNavTitle",(()=>{this.dp.isFinalView||this.dp.up()})),F(this,"update",(()=>{let{prevHtml:e,nextHtml:t}=this.opts;this.$prev.innerHTML=e,this.$next.innerHTML=t,this._resetNavStatus(),this.render(),this.handleNavStatus()})),F(this,"renderDelay",(()=>{setTimeout(this.render)})),F(this,"render",(()=>{this.$title.innerHTML=this._getTitle(),function(e,t){for(let i in t)t[i]?e.classList.add(i):e.classList.remove(i)}(this.$title,{"-disabled-":this.dp.isFinalView})})),this.dp=t,this.opts=i,this.init()}init(){this._createElement(),this._buildBaseHtml(),this._defineDOM(),this.render(),this.handleNavStatus(),this._bindEvents(),this._bindDatepickerEvents()}_defineDOM(){this.$title=a(".air-datepicker-nav--title",this.$el),this.$prev=a('[data-action="prev"]',this.$el),this.$next=a('[data-action="next"]',this.$el)}_bindEvents(){this.$el.addEventListener("click",this.onClickNav),this.$title.addEventListener("click",this.onClickNavTitle)}_bindDatepickerEvents(){this.dp.on(i.eventChangeViewDate,this.onChangeViewDate),this.dp.on(i.eventChangeCurrentView,this.onChangeCurrentView),this.isNavIsFunction&&(this.dp.on(i.eventChangeSelectedDate,this.renderDelay),this.dp.opts.timepicker&&this.dp.on(i.eventChangeTime,this.render))}destroy(){this.dp.off(i.eventChangeViewDate,this.onChangeViewDate),this.dp.off(i.eventChangeCurrentView,this.onChangeCurrentView),this.isNavIsFunction&&(this.dp.off(i.eventChangeSelectedDate,this.renderDelay),this.dp.opts.timepicker&&this.dp.off(i.eventChangeTime,this.render))}_createElement(){this.$el=n({tagName:"nav",className:"air-datepicker-nav"})}_getTitle(){let{dp:e,opts:t}=this,i=t.navTitles[e.currentView];return"function"==typeof i?i(e):e.formatDate(e.viewDate,i)}handleNavStatus(){let{disableNavWhenOutOfRange:e}=this.opts,{minDate:t,maxDate:s}=this.dp;if(!t&&!s||!e)return;let{year:a,month:n}=this.dp.parsedViewDate,r=!!t&&o(t),h=!!s&&o(s);switch(this.dp.currentView){case i.days:t&&r.month>=n&&r.year>=a&&this._disableNav("prev"),s&&h.month<=n&&h.year<=a&&this._disableNav("next");break;case i.months:t&&r.year>=a&&this._disableNav("prev"),s&&h.year<=a&&this._disableNav("next");break;case i.years:{let e=c(this.dp.viewDate);t&&r.year>=e[0]&&this._disableNav("prev"),s&&h.year<=e[1]&&this._disableNav("next");break}}}_disableNav(e){a('[data-action="'+e+'"]',this.$el).classList.add("-disabled-")}_resetNavStatus(){!function(e){for(var t=arguments.length,i=new Array(t>1?t-1:0),s=1;s<t;s++)i[s-1]=arguments[s];e.length?e.forEach((e=>{e.classList.remove(...i)})):e.classList.remove(...i)}(this.$el.querySelectorAll(".air-datepicker-nav--action"),"-disabled-")}_buildBaseHtml(){let{prevHtml:e,nextHtml:t}=this.opts;this.$el.innerHTML=`<div class="air-datepicker-nav--action" data-action="prev">${e}</div><div class="air-datepicker-nav--title"></div><div class="air-datepicker-nav--action" data-action="next">${t}</div>`}get isNavIsFunction(){let{navTitles:e}=this.opts;return Object.keys(e).find((t=>"function"==typeof e[t]))}}var x={today:{content:e=>e.locale.today,onClick:e=>e.setViewDate(new Date)},clear:{content:e=>e.locale.clear,onClick:e=>e.clear()}};class H{constructor(e){let{dp:t,opts:i}=e;this.dp=t,this.opts=i,this.init()}init(){this.createElement(),this.render()}createElement(){this.$el=n({className:"air-datepicker-buttons"})}destroy(){this.$el.parentNode.removeChild(this.$el)}clearHtml(){return this.$el.innerHTML="",this}generateButtons(){let{buttons:e}=this.opts;Array.isArray(e)||(e=[e]),e.forEach((e=>{let t=e;"string"==typeof e&&x[e]&&(t=x[e]);let i=this.createButton(t);t.onClick&&this.attachEventToButton(i,t.onClick),this.$el.appendChild(i)}))}attachEventToButton(e,t){e.addEventListener("click",(()=>{t(this.dp)}))}createButton(e){let{content:t,className:i,tagName:s="button",attrs:a={}}=e;return n({tagName:s,innerHtml:`<span tabindex='-1'>${"function"==typeof t?t(this.dp):t}</span>`,className:u("air-datepicker-button",i),attrs:a})}render(){this.generateButtons()}}function E(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}class L{constructor(){let{opts:e,dp:t}=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};E(this,"toggleTimepickerIsActive",(e=>{this.dp.timepickerIsActive=e})),E(this,"onChangeSelectedDate",(e=>{let{date:t,updateTime:i=!1}=e;t&&(this.setMinMaxTime(t),this.setCurrentTime(!!i&&t),this.addTimeToDate(t))})),E(this,"onChangeLastSelectedDate",(e=>{e&&(this.setTime(e),this.render())})),E(this,"onChangeInputRange",(e=>{let t=e.target;this[t.getAttribute("name")]=t.value,this.updateText(),this.dp.trigger(i.eventChangeTime,{hours:this.hours,minutes:this.minutes})})),E(this,"onMouseEnterLeave",(e=>{let t=e.target.getAttribute("name"),i=this.$minutesText;"hours"===t&&(i=this.$hoursText),i.classList.toggle("-focus-")})),E(this,"onFocus",(()=>{this.toggleTimepickerIsActive(!0)})),E(this,"onBlur",(()=>{this.toggleTimepickerIsActive(!1)})),this.opts=e,this.dp=t;let{timeFormat:s}=this.dp.locale;s&&(s.match(k("h"))||s.match(k("hh")))&&(this.ampm=!0),this.init()}init(){this.setTime(this.dp.lastSelectedDate||this.dp.viewDate),this.createElement(),this.buildHtml(),this.defineDOM(),this.render(),this.bindDatepickerEvents(),this.bindDOMEvents()}bindDatepickerEvents(){this.dp.on(i.eventChangeSelectedDate,this.onChangeSelectedDate),this.dp.on(i.eventChangeLastSelectedDate,this.onChangeLastSelectedDate)}bindDOMEvents(){let e="input";navigator.userAgent.match(/trident/gi)&&(e="change"),D(this.$ranges,e,this.onChangeInputRange),D(this.$ranges,"mouseenter",this.onMouseEnterLeave),D(this.$ranges,"mouseleave",this.onMouseEnterLeave),D(this.$ranges,"focus",this.onFocus),D(this.$ranges,"mousedown",this.onFocus),D(this.$ranges,"blur",this.onBlur)}createElement(){this.$el=n({className:u("air-datepicker-time",{"-am-pm-":this.dp.ampm})})}destroy(){this.dp.off(i.eventChangeSelectedDate,this.onChangeSelectedDate),this.dp.off(i.eventChangeLastSelectedDate,this.onChangeLastSelectedDate),this.$el.parentNode.removeChild(this.$el)}buildHtml(){let{ampm:e,hours:t,displayHours:i,minutes:s,minHours:a,minMinutes:n,maxHours:r,maxMinutes:h,dayPeriod:o,opts:{hoursStep:l,minutesStep:c}}=this;this.$el.innerHTML=`<div class="air-datepicker-time--current">   <span class="air-datepicker-time--current-hours">${d(i)}</span>   <span class="air-datepicker-time--current-colon">:</span>   <span class="air-datepicker-time--current-minutes">${d(s)}</span>   `+(e?`<span class='air-datepicker-time--current-ampm'>${o}</span>`:"")+'</div><div class="air-datepicker-time--sliders">   <div class="air-datepicker-time--row">'+`      <input type="range" name="hours" value="${t}" min="${a}" max="${r}" step="${l}"/>   </div>   <div class="air-datepicker-time--row">`+`      <input type="range" name="minutes" value="${s}" min="${n}" max="${h}" step="${c}"/>   </div></div>`}defineDOM(){let e=e=>a(e,this.$el);this.$ranges=this.$el.querySelectorAll('[type="range"]'),this.$hours=e('[name="hours"]'),this.$minutes=e('[name="minutes"]'),this.$hoursText=e(".air-datepicker-time--current-hours"),this.$minutesText=e(".air-datepicker-time--current-minutes"),this.$ampm=e(".air-datepicker-time--current-ampm")}setTime(e){this.setMinMaxTime(e),this.setCurrentTime(e)}addTimeToDate(e){e&&(e.setHours(this.hours),e.setMinutes(this.minutes))}setMinMaxTime(e){if(this.setMinMaxTimeFromOptions(),e){let{minDate:t,maxDate:i}=this.dp;t&&p(e,t)&&this.setMinTimeFromMinDate(t),i&&p(e,i)&&this.setMaxTimeFromMaxDate(i)}}setCurrentTime(e){let{hours:t,minutes:i}=e?o(e):this;this.hours=f(t,this.minHours,this.maxHours),this.minutes=f(i,this.minMinutes,this.maxMinutes)}setMinMaxTimeFromOptions(){let{minHours:e,minMinutes:t,maxHours:i,maxMinutes:s}=this.opts;this.minHours=f(e,0,23),this.minMinutes=f(t,0,59),this.maxHours=f(i,0,23),this.maxMinutes=f(s,0,59)}setMinTimeFromMinDate(e){let{lastSelectedDate:t}=this.dp;this.minHours=e.getHours(),t&&t.getHours()>e.getHours()?this.minMinutes=this.opts.minMinutes:this.minMinutes=e.getMinutes()}setMaxTimeFromMaxDate(e){let{lastSelectedDate:t}=this.dp;this.maxHours=e.getHours(),t&&t.getHours()<e.getHours()?this.maxMinutes=this.opts.maxMinutes:this.maxMinutes=e.getMinutes()}updateSliders(){r(this.$hours,{min:this.minHours,max:this.maxHours}).value=this.hours,r(this.$minutes,{min:this.minMinutes,max:this.maxMinutes}).value=this.minutes}updateText(){this.$hoursText.innerHTML=d(this.displayHours),this.$minutesText.innerHTML=d(this.minutes),this.ampm&&(this.$ampm.innerHTML=this.dayPeriod)}set hours(e){this._hours=e;let{hours:t,dayPeriod:i}=l(e);this.displayHours=this.ampm?t:e,this.dayPeriod=i}get hours(){return this._hours}render(){this.updateSliders(),this.updateText()}}function O(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}class A{constructor(e){let{dp:t,opts:i}=e;O(this,"pressedKeys",new Set),O(this,"hotKeys",new Map([[[["Control","ArrowRight"],["Control","ArrowUp"]],e=>e.month++],[[["Control","ArrowLeft"],["Control","ArrowDown"]],e=>e.month--],[[["Shift","ArrowRight"],["Shift","ArrowUp"]],e=>e.year++],[[["Shift","ArrowLeft"],["Shift","ArrowDown"]],e=>e.year--],[[["Alt","ArrowRight"],["Alt","ArrowUp"]],e=>e.year+=10],[[["Alt","ArrowLeft"],["Alt","ArrowDown"]],e=>e.year-=10],[["Control","Shift","ArrowUp"],(e,t)=>t.up()]])),O(this,"handleHotKey",(e=>{let t=this.hotKeys.get(e),i=o(this.getInitialFocusDate());t(i,this.dp);let{year:s,month:a,date:n}=i,r=h(new Date(s,a));r<n&&(n=r);let l=this.dp.getClampedDate(new Date(s,a,n));this.dp.setFocusDate(l,{viewDateTransition:!0})})),O(this,"isHotKeyPressed",(()=>{let e=!1,t=this.pressedKeys.size,i=e=>this.pressedKeys.has(e);for(let[s]of this.hotKeys){if(e)break;if(Array.isArray(s[0]))s.forEach((a=>{e||t!==a.length||(e=a.every(i)&&s)}));else{if(t!==s.length)continue;e=s.every(i)&&s}}return e})),O(this,"isArrow",(e=>e>=37&&e<=40)),O(this,"onKeyDown",(e=>{let{key:t,which:i}=e,{dp:s,dp:{focusDate:a},opts:n}=this;this.registerKey(t);let r=this.isHotKeyPressed();if(r)return e.preventDefault(),void this.handleHotKey(r);if(this.isArrow(i))return e.preventDefault(),void this.focusNextCell(t);if("Enter"===t){if(s.currentView!==n.minView)return void s.down();if(a){let e=s._checkIfDateIsSelected(a);return void(e?s._handleAlreadySelectedDates(e,a):s.selectDate(a))}}"Escape"===t&&this.dp.hide()})),O(this,"onKeyUp",(e=>{this.removeKey(e.key)})),this.dp=t,this.opts=i,this.init()}init(){this.bindKeyboardEvents()}bindKeyboardEvents(){let{$el:e}=this.dp;e.addEventListener("keydown",this.onKeyDown),e.addEventListener("keyup",this.onKeyUp)}destroy(){let{$el:e}=this.dp;e.removeEventListener("keydown",this.onKeyDown),e.removeEventListener("keyup",this.onKeyUp),this.hotKeys=null,this.pressedKeys=null}getInitialFocusDate(){let{focusDate:e,currentView:t,selectedDates:s,parsedViewDate:{year:a,month:n}}=this.dp,r=e||s[s.length-1];if(!r)switch(t){case i.days:r=new Date(a,n,(new Date).getDate());break;case i.months:r=new Date(a,n,1);break;case i.years:r=new Date(a,0,1)}return r}focusNextCell(e){let t=this.getInitialFocusDate(),{currentView:s}=this.dp,{days:a,months:n,years:r}=i,h=o(t),l=h.year,d=h.month,c=h.date;switch(e){case"ArrowLeft":s===a&&(c-=1),s===n&&(d-=1),s===r&&(l-=1);break;case"ArrowUp":s===a&&(c-=7),s===n&&(d-=3),s===r&&(l-=4);break;case"ArrowRight":s===a&&(c+=1),s===n&&(d+=1),s===r&&(l+=1);break;case"ArrowDown":s===a&&(c+=7),s===n&&(d+=3),s===r&&(l+=4)}let u=this.dp.getClampedDate(new Date(l,d,c));this.dp.setFocusDate(u,{viewDateTransition:!0})}registerKey(e){this.pressedKeys.add(e)}removeKey(e){this.pressedKeys.delete(e)}}let N={on(e,t){this.__events||(this.__events={}),this.__events[e]?this.__events[e].push(t):this.__events[e]=[t]},off(e,t){this.__events&&this.__events[e]&&(this.__events[e]=this.__events[e].filter((e=>e!==t)))},removeAllEvents(){this.__events={}},trigger(e){for(var t=arguments.length,i=new Array(t>1?t-1:0),s=1;s<t;s++)i[s-1]=arguments[s];this.__events&&this.__events[e]&&this.__events[e].forEach((e=>{e(...i)}))}};function I(e,t,i){return(t=function(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var i=e[Symbol.toPrimitive];if(void 0!==i){var s=i.call(e,"string");if("object"!=typeof s)return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==typeof t?t:String(t)}(t))in e?Object.defineProperty(e,t,{value:i,enumerable:!0,configurable:!0,writable:!0}):e[t]=i,e}let P="",j="",R=!1;class B{static buildGlobalContainer(e){R=!0,P=n({className:e,id:e}),a("body").appendChild(P)}constructor(e,t){var r=this;if(I(this,"viewIndexes",[i.days,i.months,i.years]),I(this,"next",(()=>{let{year:e,month:t}=this.parsedViewDate;switch(this.currentView){case i.days:this.setViewDate(new Date(e,t+1,1));break;case i.months:this.setViewDate(new Date(e+1,t,1));break;case i.years:this.setViewDate(new Date(e+10,0,1))}})),I(this,"prev",(()=>{let{year:e,month:t}=this.parsedViewDate;switch(this.currentView){case i.days:this.setViewDate(new Date(e,t-1,1));break;case i.months:this.setViewDate(new Date(e-1,t,1));break;case i.years:this.setViewDate(new Date(e-10,0,1))}})),I(this,"_finishHide",(()=>{this.hideAnimation=!1,this._destroyComponents(),this.$container.removeChild(this.$datepicker)})),I(this,"setPosition",(function(e){let t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];if("function"==typeof(e=e||r.opts.position))return void(r.customHide=e({$datepicker:r.$datepicker,$target:r.$el,$pointer:r.$pointer,isViewChange:t,done:r._finishHide}));let i,s,{isMobile:a}=r.opts,n=r.$el.getBoundingClientRect(),h=r.$el.getBoundingClientRect(),o=r.$datepicker.offsetParent,l=r.$el.offsetParent,d=r.$datepicker.getBoundingClientRect(),c=e.split(" "),u=window.scrollY,p=window.scrollX,m=r.opts.offset,v=c[0],g=c[1];if(a)r.$datepicker.style.cssText="left: 50%; top: 50%";else{if(o===l&&o!==document.body&&(h={top:r.$el.offsetTop,left:r.$el.offsetLeft,width:n.width,height:r.$el.offsetHeight},u=0,p=0),o!==l&&o!==document.body){let e=o.getBoundingClientRect();h={top:n.top-e.top,left:n.left-e.left,width:n.width,height:n.height},u=0,p=0}switch(v){case"top":i=h.top-d.height-m;break;case"right":s=h.left+h.width+m;break;case"bottom":i=h.top+h.height+m;break;case"left":s=h.left-d.width-m}switch(g){case"top":i=h.top;break;case"right":s=h.left+h.width-d.width;break;case"bottom":i=h.top+h.height-d.height;break;case"left":s=h.left;break;case"center":/left|right/.test(v)?i=h.top+h.height/2-d.height/2:s=h.left+h.width/2-d.width/2}r.$datepicker.style.cssText=`left: ${s+p}px; top: ${i+u}px`}})),I(this,"_setInputValue",(()=>{let{opts:e,$altField:t,locale:{dateFormat:i}}=this,{altFieldDateFormat:s,altField:a}=e;a&&t&&(t.value=this._getInputValue(s)),this.$el.value=this._getInputValue(i)})),I(this,"_getInputValue",(e=>{let{selectedDates:t,opts:i}=this,{multipleDates:s,multipleDatesSeparator:a}=i;if(!t.length)return"";let n="function"==typeof e,r=n?e(s?t:t[0]):t.map((t=>this.formatDate(t,e)));return r=n?r:r.join(a),r})),I(this,"_checkIfDateIsSelected",(function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:i.days,s=!1;return r.selectedDates.some((i=>{let a=p(e,i,t);return s=a&&i,a})),s})),I(this,"_scheduleCallAfterTransition",(e=>{this._cancelScheduledCall(),e&&e(!1),this._onTransitionEnd=()=>{e&&e(!0)},this.$datepicker.addEventListener("transitionend",this._onTransitionEnd,{once:!0})})),I(this,"_cancelScheduledCall",(()=>{this.$datepicker.removeEventListener("transitionend",this._onTransitionEnd)})),I(this,"setViewDate",(e=>{if(!((e=b(e))instanceof Date))return;if(p(e,this.viewDate))return;let t=this.viewDate;this.viewDate=e;let{onChangeViewDate:s}=this.opts;if(s){let{month:e,year:t}=this.parsedViewDate;s({month:e,year:t,decade:this.curDecade})}this.trigger(i.eventChangeViewDate,e,t)})),I(this,"setFocusDate",(function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};(!e||(e=b(e))instanceof Date)&&(r.focusDate=e,r.opts.range&&e&&r._handleRangeOnFocus(),r.trigger(i.eventChangeFocusDate,e,t))})),I(this,"setCurrentView",(e=>{if(this.viewIndexes.includes(e)){if(this.currentView=e,this.elIsInput&&this.visible&&this.setPosition(void 0,!0),this.trigger(i.eventChangeCurrentView,e),!this.views[e]){let t=this.views[e]=new T({dp:this,opts:this.opts,type:e});this.shouldUpdateDOM&&this.$content.appendChild(t.$el)}this.opts.onChangeView&&this.opts.onChangeView(e)}})),I(this,"_updateLastSelectedDate",(e=>{this.lastSelectedDate=e,this.trigger(i.eventChangeLastSelectedDate,e)})),I(this,"destroy",(()=>{let{showEvent:e,isMobile:t}=this.opts,i=this.$datepicker.parentNode;i&&i.removeChild(this.$datepicker),this.$el.removeEventListener(e,this._onFocus),this.$el.removeEventListener("blur",this._onBlur),window.removeEventListener("resize",this._onResize),t&&this._removeMobileAttributes(),this.keyboardNav&&this.keyboardNav.destroy(),this.views=null,this.nav=null,this.$datepicker=null,this.opts=null,this.$customContainer=null,this.viewDate=null,this.focusDate=null,this.selectedDates=null,this.rangeDateFrom=null,this.rangeDateTo=null})),I(this,"update",(function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=w({},r.opts);w(r.opts,e);let{timepicker:s,buttons:a,range:n,selectedDates:h,isMobile:o}=r.opts,l=r.visible||r.treatAsInline;r._createMinMaxDates(),r._limitViewDateByMaxMinDates(),r._handleLocale(),!t.selectedDates&&h&&r.selectDate(h),e.view&&r.setCurrentView(e.view),r._setInputValue(),t.range&&!n?(r.rangeDateTo=!1,r.rangeDateFrom=!1):!t.range&&n&&r.selectedDates.length&&(r.rangeDateFrom=r.selectedDates[0],r.rangeDateTo=r.selectedDates[1]),t.timepicker&&!s?(l&&r.timepicker.destroy(),r.timepicker=!1,r.$timepicker.parentNode.removeChild(r.$timepicker)):!t.timepicker&&s&&r._addTimepicker(),!t.buttons&&a?r._addButtons():t.buttons&&!a?(r.buttons.destroy(),r.$buttons.parentNode.removeChild(r.$buttons)):l&&t.buttons&&a&&r.buttons.clearHtml().render(),!t.isMobile&&o?(r.treatAsInline||j||r._createMobileOverlay(),r._addMobileAttributes(),r.visible&&r._showMobileOverlay()):t.isMobile&&!o&&(r._removeMobileAttributes(),r.visible&&(j.classList.remove("-active-"),"function"!=typeof r.opts.position&&r.setPosition())),l&&(r.nav.update(),r.views[r.currentView].render(),r.currentView===i.days&&r.views[r.currentView].renderDayNames())})),I(this,"isOtherMonth",(e=>{let{month:t}=o(e);return t!==this.parsedViewDate.month})),I(this,"isOtherYear",(e=>{let{year:t}=o(e);return t!==this.parsedViewDate.year})),I(this,"isOtherDecade",(e=>{let{year:t}=o(e),[i,s]=c(this.viewDate);return t<i||t>s})),I(this,"_onChangeSelectedDate",(e=>{let{silent:t}=e;setTimeout((()=>{this._setInputValue(),this.opts.onSelect&&!t&&this._triggerOnSelect()}))})),I(this,"_onChangeFocusedDate",(function(e){let{viewDateTransition:t}=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(!e)return;let i=!1;t&&(i=r.isOtherMonth(e)||r.isOtherYear(e)||r.isOtherDecade(e)),i&&r.setViewDate(e),r.opts.onFocus&&r.opts.onFocus({datepicker:r,date:e})})),I(this,"_onChangeTime",(e=>{let{hours:t,minutes:i}=e,s=new Date,{lastSelectedDate:a,opts:{onSelect:n}}=this,r=a;a||(r=s);let h=this.getCell(r,this.currentViewSingular),o=h&&h.adpCell;o&&o.isDisabled||(r.setHours(t),r.setMinutes(i),a?(this._setInputValue(),n&&this._triggerOnSelect()):this.selectDate(r))})),I(this,"_onFocus",(e=>{this.visible||this.show()})),I(this,"_onBlur",(e=>{this.inFocus||!this.visible||this.opts.isMobile||this.hide()})),I(this,"_onMouseDown",(e=>{this.inFocus=!0})),I(this,"_onMouseUp",(e=>{this.inFocus=!1,this.$el.focus()})),I(this,"_onResize",(()=>{this.visible&&"function"!=typeof this.opts.position&&this.setPosition()})),I(this,"_onClickOverlay",(()=>{this.visible&&this.hide()})),I(this,"getViewDates",(function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:i.days;return T.getDatesFunction(e)(r)})),I(this,"isWeekend",(e=>this.opts.weekends.includes(e))),I(this,"getClampedDate",(e=>{let{minDate:t,maxDate:i}=this,s=e;return i&&m(e,i)?s=i:t&&v(e,t)&&(s=t),s})),this.$el=a(e),!this.$el)return;this.$datepicker=n({className:"air-datepicker"}),this.opts=w({},s,t),this.$customContainer=!!this.opts.container&&a(this.opts.container),this.$altField=a(this.opts.altField||!1);let{view:h,startDate:l}=this.opts;l||(this.opts.startDate=new Date),"INPUT"===this.$el.nodeName&&(this.elIsInput=!0),this.inited=!1,this.visible=!1,this.viewDate=b(this.opts.startDate),this.focusDate=!1,this.initialReadonly=this.$el.getAttribute("readonly"),this.customHide=!1,this.currentView=h,this.selectedDates=[],this.views={},this.keys=[],this.rangeDateFrom="",this.rangeDateTo="",this.timepickerIsActive=!1,this.treatAsInline=this.opts.inline||!this.elIsInput,this.init()}init(){let{opts:e,treatAsInline:t,opts:{inline:i,isMobile:s,selectedDates:n,keyboardNav:r,onlyTimepicker:h}}=this,o=a("body");(!R||R&&P&&!o.contains(P))&&!i&&this.elIsInput&&!this.$customContainer&&B.buildGlobalContainer(B.defaultGlobalContainerId),!s||j||t||this._createMobileOverlay(),this._handleLocale(),this._bindSubEvents(),this._createMinMaxDates(),this._limitViewDateByMaxMinDates(),this.elIsInput&&(i||this._bindEvents(),r&&!h&&(this.keyboardNav=new A({dp:this,opts:e}))),n&&this.selectDate(n,{silent:!0}),this.opts.visible&&!t&&this.show(),s&&!t&&this.$el.setAttribute("readonly",!0),t&&this._createComponents()}_createMobileOverlay(){j=n({className:"air-datepicker-overlay"}),P.appendChild(j)}_createComponents(){let{opts:e,treatAsInline:t,opts:{inline:i,buttons:s,timepicker:a,position:n,classes:r,onlyTimepicker:h,isMobile:o}}=this;this._buildBaseHtml(),this.elIsInput&&(i||this._setPositionClasses(n)),!i&&this.elIsInput||this.$datepicker.classList.add("-inline-"),r&&this.$datepicker.classList.add(...r.split(" ")),h&&this.$datepicker.classList.add("-only-timepicker-"),o&&!t&&this._addMobileAttributes(),this.views[this.currentView]=new T({dp:this,type:this.currentView,opts:e}),this.nav=new V({dp:this,opts:e}),a&&this._addTimepicker(),s&&this._addButtons(),this.$content.appendChild(this.views[this.currentView].$el),this.$nav.appendChild(this.nav.$el)}_destroyComponents(){for(let e in this.views)this.views[e].destroy();this.views={},this.nav.destroy(),this.timepicker&&this.timepicker.destroy()}_addMobileAttributes(){j.addEventListener("click",this._onClickOverlay),this.$datepicker.classList.add("-is-mobile-"),this.$el.setAttribute("readonly",!0)}_removeMobileAttributes(){j.removeEventListener("click",this._onClickOverlay),this.$datepicker.classList.remove("-is-mobile-"),this.initialReadonly||""===this.initialReadonly||this.$el.removeAttribute("readonly")}_createMinMaxDates(){let{minDate:e,maxDate:t}=this.opts;this.minDate=!!e&&b(e),this.maxDate=!!t&&b(t)}_addTimepicker(){this.$timepicker=n({className:"air-datepicker--time"}),this.$datepicker.appendChild(this.$timepicker),this.timepicker=new L({dp:this,opts:this.opts}),this.$timepicker.appendChild(this.timepicker.$el)}_addButtons(){this.$buttons=n({className:"air-datepicker--buttons"}),this.$datepicker.appendChild(this.$buttons),this.buttons=new H({dp:this,opts:this.opts}),this.$buttons.appendChild(this.buttons.$el)}_bindSubEvents(){this.on(i.eventChangeSelectedDate,this._onChangeSelectedDate),this.on(i.eventChangeFocusDate,this._onChangeFocusedDate),this.on(i.eventChangeTime,this._onChangeTime)}_buildBaseHtml(){let{inline:e}=this.opts;var t,i;this.elIsInput?e?(t=this.$datepicker,(i=this.$el).parentNode.insertBefore(t,i.nextSibling)):this.$container.appendChild(this.$datepicker):this.$el.appendChild(this.$datepicker),this.$datepicker.innerHTML='<i class="air-datepicker--pointer"></i><div class="air-datepicker--navigation"></div><div class="air-datepicker--content"></div>',this.$content=a(".air-datepicker--content",this.$datepicker),this.$pointer=a(".air-datepicker--pointer",this.$datepicker),this.$nav=a(".air-datepicker--navigation",this.$datepicker)}_handleLocale(){let{locale:e,dateFormat:t,firstDay:i,timepicker:s,onlyTimepicker:a,timeFormat:n,dateTimeSeparator:r}=this.opts;var h;this.locale=(h=e,JSON.parse(JSON.stringify(h))),t&&(this.locale.dateFormat=t),void 0!==n&&""!==n&&(this.locale.timeFormat=n);let{timeFormat:o}=this.locale;if(""!==i&&(this.locale.firstDay=i),s&&"function"!=typeof t){let e=o?r:"";this.locale.dateFormat=[this.locale.dateFormat,o||""].join(e)}a&&"function"!=typeof t&&(this.locale.dateFormat=this.locale.timeFormat)}_setPositionClasses(e){if("function"==typeof e)return void this.$datepicker.classList.add("-custom-position-");let t=(e=e.split(" "))[0],i=`air-datepicker -${t}-${e[1]}- -from-${t}-`;this.$datepicker.classList.add(...i.split(" "))}_bindEvents(){this.$el.addEventListener(this.opts.showEvent,this._onFocus),this.$el.addEventListener("blur",this._onBlur),this.$datepicker.addEventListener("mousedown",this._onMouseDown),this.$datepicker.addEventListener("mouseup",this._onMouseUp),window.addEventListener("resize",this._onResize)}_limitViewDateByMaxMinDates(){let{viewDate:e,minDate:t,maxDate:i}=this;i&&m(e,i)&&this.setViewDate(i),t&&v(e,t)&&this.setViewDate(t)}formatDate(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:this.viewDate,t=arguments.length>1?arguments[1]:void 0;if(e=b(e),!(e instanceof Date))return;let i=t,s=this.locale,a=o(e),n=a.dayPeriod,r=c(e),h=B.replacer,l={T:e.getTime(),m:a.minutes,mm:a.fullMinutes,h:a.hours12,hh:a.fullHours12,H:a.hours,HH:a.fullHours,aa:n,AA:n.toUpperCase(),E:s.daysShort[a.day],EEEE:s.days[a.day],d:a.date,dd:a.fullDate,M:a.month+1,MM:a.fullMonth,MMM:s.monthsShort[a.month],MMMM:s.months[a.month],yy:a.year.toString().slice(-2),yyyy:a.year,yyyy1:r[0],yyyy2:r[1]};for(let[e,t]of Object.entries(l))i=h(i,k(e),t);return i}down(e){this._handleUpDownActions(e,"down")}up(e){this._handleUpDownActions(e,"up")}selectDate(e){let t,s=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},{currentView:a,parsedViewDate:n,selectedDates:r}=this,{updateTime:h}=s,{moveToOtherMonthsOnSelect:o,moveToOtherYearsOnSelect:l,multipleDates:d,range:c,autoClose:u,onBeforeSelect:p}=this.opts,v=r.length;if(Array.isArray(e))return e.forEach((e=>{this.selectDate(e,s)})),new Promise((e=>{setTimeout(e)}));if((e=b(e))instanceof Date){if(p&&!p({date:e,datepicker:this}))return Promise.resolve();if(a===i.days&&e.getMonth()!==n.month&&o&&(t=new Date(e.getFullYear(),e.getMonth(),1)),a===i.years&&e.getFullYear()!==n.year&&l&&(t=new Date(e.getFullYear(),0,1)),t&&this.setViewDate(t),d&&!c){if(v===d)return;this._checkIfDateIsSelected(e)||r.push(e)}else if(c)switch(v){case 1:r.push(e),this.rangeDateTo||(this.rangeDateTo=e),m(this.rangeDateFrom,this.rangeDateTo)&&(this.rangeDateTo=this.rangeDateFrom,this.rangeDateFrom=e),this.selectedDates=[this.rangeDateFrom,this.rangeDateTo];break;case 2:this.selectedDates=[e],this.rangeDateFrom=e,this.rangeDateTo="";break;default:this.selectedDates=[e],this.rangeDateFrom=e}else this.selectedDates=[e];return this.trigger(i.eventChangeSelectedDate,{action:i.actionSelectDate,silent:null==s?void 0:s.silent,date:e,updateTime:h}),this._updateLastSelectedDate(e),u&&!this.timepickerIsActive&&this.visible&&(d||c?c&&1===v&&this.hide():this.hide()),new Promise((e=>{setTimeout(e)}))}}unselectDate(e){let t=this.selectedDates,s=this;if((e=b(e))instanceof Date)return t.some(((a,n)=>{if(p(a,e))return t.splice(n,1),s.selectedDates.length?s._updateLastSelectedDate(s.selectedDates[s.selectedDates.length-1]):(s.rangeDateFrom="",s.rangeDateTo="",s._updateLastSelectedDate(!1)),this.trigger(i.eventChangeSelectedDate,{action:i.actionUnselectDate,date:e}),!0}))}replaceDate(e,t){let s=this.selectedDates.find((t=>p(t,e,this.currentView))),a=this.selectedDates.indexOf(s);a<0||p(this.selectedDates[a],t,this.currentView)||(this.selectedDates[a]=t,this.trigger(i.eventChangeSelectedDate,{action:i.actionSelectDate,date:t,updateTime:!0}),this._updateLastSelectedDate(t))}clear(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return this.selectedDates=[],this.rangeDateFrom=!1,this.rangeDateTo=!1,this.lastSelectedDate=!1,this.trigger(i.eventChangeSelectedDate,{action:i.actionUnselectDate,silent:e.silent}),new Promise((e=>{setTimeout(e)}))}show(){let{onShow:e,isMobile:t}=this.opts;this._cancelScheduledCall(),this.visible||this.hideAnimation||this._createComponents(),this.setPosition(this.opts.position),this.$datepicker.classList.add("-active-"),this.visible=!0,e&&this._scheduleCallAfterTransition(e),t&&this._showMobileOverlay()}hide(){let{onHide:e,isMobile:t}=this.opts,i=this._hasTransition();this.visible=!1,this.hideAnimation=!0,this.$datepicker.classList.remove("-active-"),this.customHide&&this.customHide(),this.elIsInput&&this.$el.blur(),this._scheduleCallAfterTransition((t=>{!this.customHide&&(t&&i||!t&&!i)&&this._finishHide(),e&&e(t)})),t&&j.classList.remove("-active-")}_triggerOnSelect(){let e=[],t=[],{selectedDates:i,locale:s,opts:{onSelect:a,multipleDates:n,range:r}}=this,h=n||r,o="function"==typeof s.dateFormat;i.length&&(e=i.map(g),t=o?n?s.dateFormat(e):e.map((e=>s.dateFormat(e))):e.map((e=>this.formatDate(e,s.dateFormat)))),a({date:h?e:e[0],formattedDate:h?t:t[0],datepicker:this})}_handleAlreadySelectedDates(e,t){const{range:i,toggleSelected:s}=this.opts;let a="function"==typeof s?s({datepicker:this,date:t}):s;i&&(a||2!==this.selectedDates.length&&this.selectDate(t)),a?this.unselectDate(t):this._updateLastSelectedDate(e)}_handleUpDownActions(e,t){if(!((e=b(e||this.focusDate||this.viewDate))instanceof Date))return;let i="up"===t?this.viewIndex+1:this.viewIndex-1;i>2&&(i=2),i<0&&(i=0),this.setViewDate(new Date(e.getFullYear(),e.getMonth(),1)),this.setCurrentView(this.viewIndexes[i])}_handleRangeOnFocus(){1===this.selectedDates.length&&(m(this.selectedDates[0],this.focusDate)?(this.rangeDateTo=this.selectedDates[0],this.rangeDateFrom=this.focusDate):(this.rangeDateTo=this.focusDate,this.rangeDateFrom=this.selectedDates[0]))}getCell(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:i.day;if(!((e=b(e))instanceof Date))return;let{year:s,month:a,date:n}=o(e),r=`[data-year="${s}"]`,h=`[data-month="${a}"]`,l={[i.day]:`${r}${h}[data-date="${n}"]`,[i.month]:`${r}${h}`,[i.year]:`${r}`};return this.views[this.currentView].$el.querySelector(l[t])}_showMobileOverlay(){j.classList.add("-active-")}_hasTransition(){return window.getComputedStyle(this.$datepicker).getPropertyValue("transition-duration").split(", ").reduce(((e,t)=>parseFloat(t)+e),0)>0}get shouldUpdateDOM(){return this.visible||this.treatAsInline}get parsedViewDate(){return o(this.viewDate)}get currentViewSingular(){return this.currentView.slice(0,-1)}get curDecade(){return c(this.viewDate)}get viewIndex(){return this.viewIndexes.indexOf(this.currentView)}get isFinalView(){return this.currentView===i.years}get hasSelectedDates(){return this.selectedDates.length>0}get isMinViewReached(){return this.currentView===this.opts.minView||this.currentView===i.days}get $container(){return this.$customContainer||P}static replacer(e,t,i){return e.replace(t,(function(e,t,s,a){return t+i+a}))}}var K;return I(B,"defaults",s),I(B,"version","3.4.0"),I(B,"defaultGlobalContainerId","air-datepicker-global-container"),K=B.prototype,Object.assign(K,N),t.default}()}));
/*!
 * imagesLoaded PACKAGED v5.0.0
 * JavaScript is all like "You images are done yet or what?"
 * MIT License
 */
!function(t,e){"object"==typeof module&&module.exports?module.exports=e():t.EvEmitter=e()}("undefined"!=typeof window?window:this,(function(){function t(){}let e=t.prototype;return e.on=function(t,e){if(!t||!e)return this;let i=this._events=this._events||{},s=i[t]=i[t]||[];return s.includes(e)||s.push(e),this},e.once=function(t,e){if(!t||!e)return this;this.on(t,e);let i=this._onceEvents=this._onceEvents||{};return(i[t]=i[t]||{})[e]=!0,this},e.off=function(t,e){let i=this._events&&this._events[t];if(!i||!i.length)return this;let s=i.indexOf(e);return-1!=s&&i.splice(s,1),this},e.emitEvent=function(t,e){let i=this._events&&this._events[t];if(!i||!i.length)return this;i=i.slice(0),e=e||[];let s=this._onceEvents&&this._onceEvents[t];for(let n of i){s&&s[n]&&(this.off(t,n),delete s[n]),n.apply(this,e)}return this},e.allOff=function(){return delete this._events,delete this._onceEvents,this},t})),

/*!
 * @fileOverview TouchSwipe - jQuery Plugin
 * @version 1.6.18
 *
 * @author Matt Bryson http://www.github.com/mattbryson
 * @see https://github.com/mattbryson/TouchSwipe-Jquery-Plugin
 * @see http://labs.rampinteractive.co.uk/touchSwipe/
 * @see http://plugins.jquery.com/project/touchSwipe
 * @license
 * Copyright (c) 2010-2015 Matt Bryson
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 */

!(function (factory) {
	"function" == typeof define && define.amd && define.amd.jQuery
		? define(["jquery"], factory)
		: factory(
				"undefined" != typeof module && module.exports
					? require("jquery")
					: jQuery
		  );
})(function ($) {
	"use strict";
	function init(options) {
		return (
			!options ||
				void 0 !== options.allowPageScroll ||
				(void 0 === options.swipe && void 0 === options.swipeStatus) ||
				(options.allowPageScroll = NONE),
			void 0 !== options.click &&
				void 0 === options.tap &&
				(options.tap = options.click),
			options || (options = {}),
			(options = $.extend({}, $.fn.swipe.defaults, options)),
			this.each(function () {
				var $this = $(this),
					plugin = $this.data(PLUGIN_NS);
				plugin ||
					((plugin = new TouchSwipe(this, options)),
					$this.data(PLUGIN_NS, plugin));
			})
		);
	}
	function TouchSwipe(element, options) {
		function touchStart(jqEvent) {
			if (
				!(
					getTouchInProgress() ||
					$(jqEvent.target).closest(
						options.excludedElements,
						$element
					).length > 0
				)
			) {
				var event = jqEvent.originalEvent
					? jqEvent.originalEvent
					: jqEvent;
				if (
					!event.pointerType ||
					"mouse" != event.pointerType ||
					0 != options.fallbackToMouseEvents
				) {
					var ret,
						touches = event.touches,
						evt = touches ? touches[0] : event;
					return (
						(phase = PHASE_START),
						touches
							? (fingerCount = touches.length)
							: options.preventDefaultEvents !== !1 &&
							  jqEvent.preventDefault(),
						(distance = 0),
						(direction = null),
						(currentDirection = null),
						(pinchDirection = null),
						(duration = 0),
						(startTouchesDistance = 0),
						(endTouchesDistance = 0),
						(pinchZoom = 1),
						(pinchDistance = 0),
						(maximumsMap = createMaximumsData()),
						cancelMultiFingerRelease(),
						createFingerData(0, evt),
						!touches ||
						fingerCount === options.fingers ||
						options.fingers === ALL_FINGERS ||
						hasPinches()
							? ((startTime = getTimeStamp()),
							  2 == fingerCount &&
									(createFingerData(1, touches[1]),
									(startTouchesDistance = endTouchesDistance =
										calculateTouchesDistance(
											fingerData[0].start,
											fingerData[1].start
										))),
							  (options.swipeStatus || options.pinchStatus) &&
									(ret = triggerHandler(event, phase)))
							: (ret = !1),
						ret === !1
							? ((phase = PHASE_CANCEL),
							  triggerHandler(event, phase),
							  ret)
							: (options.hold &&
									(holdTimeout = setTimeout(
										$.proxy(function () {
											$element.trigger("hold", [
												event.target,
											]),
												options.hold &&
													(ret = options.hold.call(
														$element,
														event,
														event.target
													));
										}, this),
										options.longTapThreshold
									)),
							  setTouchInProgress(!0),
							  null)
					);
				}
			}
		}
		function touchMove(jqEvent) {
			var event = jqEvent.originalEvent ? jqEvent.originalEvent : jqEvent;
			if (
				phase !== PHASE_END &&
				phase !== PHASE_CANCEL &&
				!inMultiFingerRelease()
			) {
				var ret,
					touches = event.touches,
					evt = touches ? touches[0] : event,
					currentFinger = updateFingerData(evt);
				if (
					((endTime = getTimeStamp()),
					touches && (fingerCount = touches.length),
					options.hold && clearTimeout(holdTimeout),
					(phase = PHASE_MOVE),
					2 == fingerCount &&
						(0 == startTouchesDistance
							? (createFingerData(1, touches[1]),
							  (startTouchesDistance = endTouchesDistance =
									calculateTouchesDistance(
										fingerData[0].start,
										fingerData[1].start
									)))
							: (updateFingerData(touches[1]),
							  (endTouchesDistance = calculateTouchesDistance(
									fingerData[0].end,
									fingerData[1].end
							  )),
							  (pinchDirection = calculatePinchDirection(
									fingerData[0].end,
									fingerData[1].end
							  ))),
						(pinchZoom = calculatePinchZoom(
							startTouchesDistance,
							endTouchesDistance
						)),
						(pinchDistance = Math.abs(
							startTouchesDistance - endTouchesDistance
						))),
					fingerCount === options.fingers ||
						options.fingers === ALL_FINGERS ||
						!touches ||
						hasPinches())
				) {
					if (
						((direction = calculateDirection(
							currentFinger.start,
							currentFinger.end
						)),
						(currentDirection = calculateDirection(
							currentFinger.last,
							currentFinger.end
						)),
						validateDefaultEvent(jqEvent, currentDirection),
						(distance = calculateDistance(
							currentFinger.start,
							currentFinger.end
						)),
						(duration = calculateDuration()),
						setMaxDistance(direction, distance),
						(ret = triggerHandler(event, phase)),
						!options.triggerOnTouchEnd ||
							options.triggerOnTouchLeave)
					) {
						var inBounds = !0;
						if (options.triggerOnTouchLeave) {
							var bounds = getbounds(this);
							inBounds = isInBounds(currentFinger.end, bounds);
						}
						!options.triggerOnTouchEnd && inBounds
							? (phase = getNextPhase(PHASE_MOVE))
							: options.triggerOnTouchLeave &&
							  !inBounds &&
							  (phase = getNextPhase(PHASE_END)),
							(phase != PHASE_CANCEL && phase != PHASE_END) ||
								triggerHandler(event, phase);
					}
				} else (phase = PHASE_CANCEL), triggerHandler(event, phase);
				ret === !1 &&
					((phase = PHASE_CANCEL), triggerHandler(event, phase));
			}
		}
		function touchEnd(jqEvent) {
			var event = jqEvent.originalEvent ? jqEvent.originalEvent : jqEvent,
				touches = event.touches;
			if (touches) {
				if (touches.length && !inMultiFingerRelease())
					return startMultiFingerRelease(event), !0;
				if (touches.length && inMultiFingerRelease()) return !0;
			}
			return (
				inMultiFingerRelease() && (fingerCount = fingerCountAtRelease),
				(endTime = getTimeStamp()),
				(duration = calculateDuration()),
				didSwipeBackToCancel() || !validateSwipeDistance()
					? ((phase = PHASE_CANCEL), triggerHandler(event, phase))
					: options.triggerOnTouchEnd ||
					  (options.triggerOnTouchEnd === !1 && phase === PHASE_MOVE)
					? (options.preventDefaultEvents !== !1 &&
							jqEvent.preventDefault(),
					  (phase = PHASE_END),
					  triggerHandler(event, phase))
					: !options.triggerOnTouchEnd && hasTap()
					? ((phase = PHASE_END),
					  triggerHandlerForGesture(event, phase, TAP))
					: phase === PHASE_MOVE &&
					  ((phase = PHASE_CANCEL), triggerHandler(event, phase)),
				setTouchInProgress(!1),
				null
			);
		}
		function touchCancel() {
			(fingerCount = 0),
				(endTime = 0),
				(startTime = 0),
				(startTouchesDistance = 0),
				(endTouchesDistance = 0),
				(pinchZoom = 1),
				cancelMultiFingerRelease(),
				setTouchInProgress(!1);
		}
		function touchLeave(jqEvent) {
			var event = jqEvent.originalEvent ? jqEvent.originalEvent : jqEvent;
			options.triggerOnTouchLeave &&
				((phase = getNextPhase(PHASE_END)),
				triggerHandler(event, phase));
		}
		function removeListeners() {
			$element.unbind(START_EV, touchStart),
				$element.unbind(CANCEL_EV, touchCancel),
				$element.unbind(MOVE_EV, touchMove),
				$element.unbind(END_EV, touchEnd),
				LEAVE_EV && $element.unbind(LEAVE_EV, touchLeave),
				setTouchInProgress(!1);
		}
		function getNextPhase(currentPhase) {
			var nextPhase = currentPhase,
				validTime = validateSwipeTime(),
				validDistance = validateSwipeDistance(),
				didCancel = didSwipeBackToCancel();
			return (
				!validTime || didCancel
					? (nextPhase = PHASE_CANCEL)
					: !validDistance ||
					  currentPhase != PHASE_MOVE ||
					  (options.triggerOnTouchEnd &&
							!options.triggerOnTouchLeave)
					? !validDistance &&
					  currentPhase == PHASE_END &&
					  options.triggerOnTouchLeave &&
					  (nextPhase = PHASE_CANCEL)
					: (nextPhase = PHASE_END),
				nextPhase
			);
		}
		function triggerHandler(event, phase) {
			var ret,
				touches = event.touches;
			return (
				(didSwipe() || hasSwipes()) &&
					(ret = triggerHandlerForGesture(event, phase, SWIPE)),
				(didPinch() || hasPinches()) &&
					ret !== !1 &&
					(ret = triggerHandlerForGesture(event, phase, PINCH)),
				didDoubleTap() && ret !== !1
					? (ret = triggerHandlerForGesture(event, phase, DOUBLE_TAP))
					: didLongTap() && ret !== !1
					? (ret = triggerHandlerForGesture(event, phase, LONG_TAP))
					: didTap() &&
					  ret !== !1 &&
					  (ret = triggerHandlerForGesture(event, phase, TAP)),
				phase === PHASE_CANCEL && touchCancel(event),
				phase === PHASE_END &&
					(touches
						? touches.length || touchCancel(event)
						: touchCancel(event)),
				ret
			);
		}
		function triggerHandlerForGesture(event, phase, gesture) {
			var ret;
			if (gesture == SWIPE) {
				if (
					($element.trigger("swipeStatus", [
						phase,
						direction || null,
						distance || 0,
						duration || 0,
						fingerCount,
						fingerData,
						currentDirection,
					]),
					options.swipeStatus &&
						((ret = options.swipeStatus.call(
							$element,
							event,
							phase,
							direction || null,
							distance || 0,
							duration || 0,
							fingerCount,
							fingerData,
							currentDirection
						)),
						ret === !1))
				)
					return !1;
				if (phase == PHASE_END && validateSwipe()) {
					if (
						(clearTimeout(singleTapTimeout),
						clearTimeout(holdTimeout),
						$element.trigger("swipe", [
							direction,
							distance,
							duration,
							fingerCount,
							fingerData,
							currentDirection,
						]),
						options.swipe &&
							((ret = options.swipe.call(
								$element,
								event,
								direction,
								distance,
								duration,
								fingerCount,
								fingerData,
								currentDirection
							)),
							ret === !1))
					)
						return !1;
					switch (direction) {
						case LEFT:
							$element.trigger("swipeLeft", [
								direction,
								distance,
								duration,
								fingerCount,
								fingerData,
								currentDirection,
							]),
								options.swipeLeft &&
									(ret = options.swipeLeft.call(
										$element,
										event,
										direction,
										distance,
										duration,
										fingerCount,
										fingerData,
										currentDirection
									));
							break;
						case RIGHT:
							$element.trigger("swipeRight", [
								direction,
								distance,
								duration,
								fingerCount,
								fingerData,
								currentDirection,
							]),
								options.swipeRight &&
									(ret = options.swipeRight.call(
										$element,
										event,
										direction,
										distance,
										duration,
										fingerCount,
										fingerData,
										currentDirection
									));
							break;
						case UP:
							$element.trigger("swipeUp", [
								direction,
								distance,
								duration,
								fingerCount,
								fingerData,
								currentDirection,
							]),
								options.swipeUp &&
									(ret = options.swipeUp.call(
										$element,
										event,
										direction,
										distance,
										duration,
										fingerCount,
										fingerData,
										currentDirection
									));
							break;
						case DOWN:
							$element.trigger("swipeDown", [
								direction,
								distance,
								duration,
								fingerCount,
								fingerData,
								currentDirection,
							]),
								options.swipeDown &&
									(ret = options.swipeDown.call(
										$element,
										event,
										direction,
										distance,
										duration,
										fingerCount,
										fingerData,
										currentDirection
									));
					}
				}
			}
			if (gesture == PINCH) {
				if (
					($element.trigger("pinchStatus", [
						phase,
						pinchDirection || null,
						pinchDistance || 0,
						duration || 0,
						fingerCount,
						pinchZoom,
						fingerData,
					]),
					options.pinchStatus &&
						((ret = options.pinchStatus.call(
							$element,
							event,
							phase,
							pinchDirection || null,
							pinchDistance || 0,
							duration || 0,
							fingerCount,
							pinchZoom,
							fingerData
						)),
						ret === !1))
				)
					return !1;
				if (phase == PHASE_END && validatePinch())
					switch (pinchDirection) {
						case IN:
							$element.trigger("pinchIn", [
								pinchDirection || null,
								pinchDistance || 0,
								duration || 0,
								fingerCount,
								pinchZoom,
								fingerData,
							]),
								options.pinchIn &&
									(ret = options.pinchIn.call(
										$element,
										event,
										pinchDirection || null,
										pinchDistance || 0,
										duration || 0,
										fingerCount,
										pinchZoom,
										fingerData
									));
							break;
						case OUT:
							$element.trigger("pinchOut", [
								pinchDirection || null,
								pinchDistance || 0,
								duration || 0,
								fingerCount,
								pinchZoom,
								fingerData,
							]),
								options.pinchOut &&
									(ret = options.pinchOut.call(
										$element,
										event,
										pinchDirection || null,
										pinchDistance || 0,
										duration || 0,
										fingerCount,
										pinchZoom,
										fingerData
									));
					}
			}
			return (
				gesture == TAP
					? (phase !== PHASE_CANCEL && phase !== PHASE_END) ||
					  (clearTimeout(singleTapTimeout),
					  clearTimeout(holdTimeout),
					  hasDoubleTap() && !inDoubleTap()
							? ((doubleTapStartTime = getTimeStamp()),
							  (singleTapTimeout = setTimeout(
									$.proxy(function () {
										(doubleTapStartTime = null),
											$element.trigger("tap", [
												event.target,
											]),
											options.tap &&
												(ret = options.tap.call(
													$element,
													event,
													event.target
												));
									}, this),
									options.doubleTapThreshold
							  )))
							: ((doubleTapStartTime = null),
							  $element.trigger("tap", [event.target]),
							  options.tap &&
									(ret = options.tap.call(
										$element,
										event,
										event.target
									))))
					: gesture == DOUBLE_TAP
					? (phase !== PHASE_CANCEL && phase !== PHASE_END) ||
					  (clearTimeout(singleTapTimeout),
					  clearTimeout(holdTimeout),
					  (doubleTapStartTime = null),
					  $element.trigger("doubletap", [event.target]),
					  options.doubleTap &&
							(ret = options.doubleTap.call(
								$element,
								event,
								event.target
							)))
					: gesture == LONG_TAP &&
					  ((phase !== PHASE_CANCEL && phase !== PHASE_END) ||
							(clearTimeout(singleTapTimeout),
							(doubleTapStartTime = null),
							$element.trigger("longtap", [event.target]),
							options.longTap &&
								(ret = options.longTap.call(
									$element,
									event,
									event.target
								)))),
				ret
			);
		}
		function validateSwipeDistance() {
			var valid = !0;
			return (
				null !== options.threshold &&
					(valid = distance >= options.threshold),
				valid
			);
		}
		function didSwipeBackToCancel() {
			var cancelled = !1;
			return (
				null !== options.cancelThreshold &&
					null !== direction &&
					(cancelled =
						getMaxDistance(direction) - distance >=
						options.cancelThreshold),
				cancelled
			);
		}
		function validatePinchDistance() {
			return (
				null === options.pinchThreshold ||
				pinchDistance >= options.pinchThreshold
			);
		}
		function validateSwipeTime() {
			var result;
			return (result =
				!options.maxTimeThreshold ||
				!(duration >= options.maxTimeThreshold));
		}
		function validateDefaultEvent(jqEvent, direction) {
			if (options.preventDefaultEvents !== !1)
				if (options.allowPageScroll === NONE) jqEvent.preventDefault();
				else {
					var auto = options.allowPageScroll === AUTO;
					switch (direction) {
						case LEFT:
							((options.swipeLeft && auto) ||
								(!auto &&
									options.allowPageScroll != HORIZONTAL)) &&
								jqEvent.preventDefault();
							break;
						case RIGHT:
							((options.swipeRight && auto) ||
								(!auto &&
									options.allowPageScroll != HORIZONTAL)) &&
								jqEvent.preventDefault();
							break;
						case UP:
							((options.swipeUp && auto) ||
								(!auto &&
									options.allowPageScroll != VERTICAL)) &&
								jqEvent.preventDefault();
							break;
						case DOWN:
							((options.swipeDown && auto) ||
								(!auto &&
									options.allowPageScroll != VERTICAL)) &&
								jqEvent.preventDefault();
							break;
						case NONE:
					}
				}
		}
		function validatePinch() {
			var hasCorrectFingerCount = validateFingers(),
				hasEndPoint = validateEndPoint(),
				hasCorrectDistance = validatePinchDistance();
			return hasCorrectFingerCount && hasEndPoint && hasCorrectDistance;
		}
		function hasPinches() {
			return !!(
				options.pinchStatus ||
				options.pinchIn ||
				options.pinchOut
			);
		}
		function didPinch() {
			return !(!validatePinch() || !hasPinches());
		}
		function validateSwipe() {
			var hasValidTime = validateSwipeTime(),
				hasValidDistance = validateSwipeDistance(),
				hasCorrectFingerCount = validateFingers(),
				hasEndPoint = validateEndPoint(),
				didCancel = didSwipeBackToCancel(),
				valid =
					!didCancel &&
					hasEndPoint &&
					hasCorrectFingerCount &&
					hasValidDistance &&
					hasValidTime;
			return valid;
		}
		function hasSwipes() {
			return !!(
				options.swipe ||
				options.swipeStatus ||
				options.swipeLeft ||
				options.swipeRight ||
				options.swipeUp ||
				options.swipeDown
			);
		}
		function didSwipe() {
			return !(!validateSwipe() || !hasSwipes());
		}
		function validateFingers() {
			return (
				fingerCount === options.fingers ||
				options.fingers === ALL_FINGERS ||
				!SUPPORTS_TOUCH
			);
		}
		function validateEndPoint() {
			return 0 !== fingerData[0].end.x;
		}
		function hasTap() {
			return !!options.tap;
		}
		function hasDoubleTap() {
			return !!options.doubleTap;
		}
		function hasLongTap() {
			return !!options.longTap;
		}
		function validateDoubleTap() {
			if (null == doubleTapStartTime) return !1;
			var now = getTimeStamp();
			return (
				hasDoubleTap() &&
				now - doubleTapStartTime <= options.doubleTapThreshold
			);
		}
		function inDoubleTap() {
			return validateDoubleTap();
		}
		function validateTap() {
			return (
				(1 === fingerCount || !SUPPORTS_TOUCH) &&
				(isNaN(distance) || distance < options.threshold)
			);
		}
		function validateLongTap() {
			return (
				duration > options.longTapThreshold &&
				distance < DOUBLE_TAP_THRESHOLD
			);
		}
		function didTap() {
			return !(!validateTap() || !hasTap());
		}
		function didDoubleTap() {
			return !(!validateDoubleTap() || !hasDoubleTap());
		}
		function didLongTap() {
			return !(!validateLongTap() || !hasLongTap());
		}
		function startMultiFingerRelease(event) {
			(previousTouchEndTime = getTimeStamp()),
				(fingerCountAtRelease = event.touches.length + 1);
		}
		function cancelMultiFingerRelease() {
			(previousTouchEndTime = 0), (fingerCountAtRelease = 0);
		}
		function inMultiFingerRelease() {
			var withinThreshold = !1;
			if (previousTouchEndTime) {
				var diff = getTimeStamp() - previousTouchEndTime;
				diff <= options.fingerReleaseThreshold &&
					(withinThreshold = !0);
			}
			return withinThreshold;
		}
		function getTouchInProgress() {
			return !($element.data(PLUGIN_NS + "_intouch") !== !0);
		}
		function setTouchInProgress(val) {
			$element &&
				(val === !0
					? ($element.bind(MOVE_EV, touchMove),
					  $element.bind(END_EV, touchEnd),
					  LEAVE_EV && $element.bind(LEAVE_EV, touchLeave))
					: ($element.unbind(MOVE_EV, touchMove, !1),
					  $element.unbind(END_EV, touchEnd, !1),
					  LEAVE_EV && $element.unbind(LEAVE_EV, touchLeave, !1)),
				$element.data(PLUGIN_NS + "_intouch", val === !0));
		}
		function createFingerData(id, evt) {
			var f = {
				start: { x: 0, y: 0 },
				last: { x: 0, y: 0 },
				end: { x: 0, y: 0 },
			};
			return (
				(f.start.x = f.last.x = f.end.x = evt.pageX || evt.clientX),
				(f.start.y = f.last.y = f.end.y = evt.pageY || evt.clientY),
				(fingerData[id] = f),
				f
			);
		}
		function updateFingerData(evt) {
			var id = void 0 !== evt.identifier ? evt.identifier : 0,
				f = getFingerData(id);
			return (
				null === f && (f = createFingerData(id, evt)),
				(f.last.x = f.end.x),
				(f.last.y = f.end.y),
				(f.end.x = evt.pageX || evt.clientX),
				(f.end.y = evt.pageY || evt.clientY),
				f
			);
		}
		function getFingerData(id) {
			return fingerData[id] || null;
		}
		function setMaxDistance(direction, distance) {
			direction != NONE &&
				((distance = Math.max(distance, getMaxDistance(direction))),
				(maximumsMap[direction].distance = distance));
		}
		function getMaxDistance(direction) {
			if (maximumsMap[direction]) return maximumsMap[direction].distance;
		}
		function createMaximumsData() {
			var maxData = {};
			return (
				(maxData[LEFT] = createMaximumVO(LEFT)),
				(maxData[RIGHT] = createMaximumVO(RIGHT)),
				(maxData[UP] = createMaximumVO(UP)),
				(maxData[DOWN] = createMaximumVO(DOWN)),
				maxData
			);
		}
		function createMaximumVO(dir) {
			return { direction: dir, distance: 0 };
		}
		function calculateDuration() {
			return endTime - startTime;
		}
		function calculateTouchesDistance(startPoint, endPoint) {
			var diffX = Math.abs(startPoint.x - endPoint.x),
				diffY = Math.abs(startPoint.y - endPoint.y);
			return Math.round(Math.sqrt(diffX * diffX + diffY * diffY));
		}
		function calculatePinchZoom(startDistance, endDistance) {
			var percent = (endDistance / startDistance) * 1;
			return percent.toFixed(2);
		}
		function calculatePinchDirection() {
			return pinchZoom < 1 ? OUT : IN;
		}
		function calculateDistance(startPoint, endPoint) {
			return Math.round(
				Math.sqrt(
					Math.pow(endPoint.x - startPoint.x, 2) +
						Math.pow(endPoint.y - startPoint.y, 2)
				)
			);
		}
		function calculateAngle(startPoint, endPoint) {
			var x = startPoint.x - endPoint.x,
				y = endPoint.y - startPoint.y,
				r = Math.atan2(y, x),
				angle = Math.round((180 * r) / Math.PI);
			return angle < 0 && (angle = 360 - Math.abs(angle)), angle;
		}
		function calculateDirection(startPoint, endPoint) {
			if (comparePoints(startPoint, endPoint)) return NONE;
			var angle = calculateAngle(startPoint, endPoint);
			return angle <= 45 && angle >= 0
				? LEFT
				: angle <= 360 && angle >= 315
				? LEFT
				: angle >= 135 && angle <= 225
				? RIGHT
				: angle > 45 && angle < 135
				? DOWN
				: UP;
		}
		function getTimeStamp() {
			var now = new Date();
			return now.getTime();
		}
		function getbounds(el) {
			el = $(el);
			var offset = el.offset(),
				bounds = {
					left: offset.left,
					right: offset.left + el.outerWidth(),
					top: offset.top,
					bottom: offset.top + el.outerHeight(),
				};
			return bounds;
		}
		function isInBounds(point, bounds) {
			return (
				point.x > bounds.left &&
				point.x < bounds.right &&
				point.y > bounds.top &&
				point.y < bounds.bottom
			);
		}
		function comparePoints(pointA, pointB) {
			return pointA.x == pointB.x && pointA.y == pointB.y;
		}
		var options = $.extend({}, options),
			useTouchEvents =
				SUPPORTS_TOUCH ||
				SUPPORTS_POINTER ||
				!options.fallbackToMouseEvents,
			START_EV = useTouchEvents
				? SUPPORTS_POINTER
					? SUPPORTS_POINTER_IE10
						? "MSPointerDown"
						: "pointerdown"
					: "touchstart"
				: "mousedown",
			MOVE_EV = useTouchEvents
				? SUPPORTS_POINTER
					? SUPPORTS_POINTER_IE10
						? "MSPointerMove"
						: "pointermove"
					: "touchmove"
				: "mousemove",
			END_EV = useTouchEvents
				? SUPPORTS_POINTER
					? SUPPORTS_POINTER_IE10
						? "MSPointerUp"
						: "pointerup"
					: "touchend"
				: "mouseup",
			LEAVE_EV = useTouchEvents
				? SUPPORTS_POINTER
					? "mouseleave"
					: null
				: "mouseleave",
			CANCEL_EV = SUPPORTS_POINTER
				? SUPPORTS_POINTER_IE10
					? "MSPointerCancel"
					: "pointercancel"
				: "touchcancel",
			distance = 0,
			direction = null,
			currentDirection = null,
			duration = 0,
			startTouchesDistance = 0,
			endTouchesDistance = 0,
			pinchZoom = 1,
			pinchDistance = 0,
			pinchDirection = 0,
			maximumsMap = null,
			$element = $(element),
			phase = "start",
			fingerCount = 0,
			fingerData = {},
			startTime = 0,
			endTime = 0,
			previousTouchEndTime = 0,
			fingerCountAtRelease = 0,
			doubleTapStartTime = 0,
			singleTapTimeout = null,
			holdTimeout = null;
		try {
			$element.bind(START_EV, touchStart),
				$element.bind(CANCEL_EV, touchCancel);
		} catch (e) {
			$.error(
				"events not supported " +
					START_EV +
					"," +
					CANCEL_EV +
					" on jQuery.swipe"
			);
		}
		(this.enable = function () {
			return (
				this.disable(),
				$element.bind(START_EV, touchStart),
				$element.bind(CANCEL_EV, touchCancel),
				$element
			);
		}),
			(this.disable = function () {
				return removeListeners(), $element;
			}),
			(this.destroy = function () {
				removeListeners(),
					$element.data(PLUGIN_NS, null),
					($element = null);
			}),
			(this.option = function (property, value) {
				if ("object" == typeof property)
					options = $.extend(options, property);
				else if (void 0 !== options[property]) {
					if (void 0 === value) return options[property];
					options[property] = value;
				} else {
					if (!property) return options;
					$.error(
						"Option " +
							property +
							" does not exist on jQuery.swipe.options"
					);
				}
				return null;
			});
	}
	var VERSION = "1.6.18",
		LEFT = "left",
		RIGHT = "right",
		UP = "up",
		DOWN = "down",
		IN = "in",
		OUT = "out",
		NONE = "none",
		AUTO = "auto",
		SWIPE = "swipe",
		PINCH = "pinch",
		TAP = "tap",
		DOUBLE_TAP = "doubletap",
		LONG_TAP = "longtap",
		HORIZONTAL = "horizontal",
		VERTICAL = "vertical",
		ALL_FINGERS = "all",
		DOUBLE_TAP_THRESHOLD = 10,
		PHASE_START = "start",
		PHASE_MOVE = "move",
		PHASE_END = "end",
		PHASE_CANCEL = "cancel",
		SUPPORTS_TOUCH = "ontouchstart" in window,
		SUPPORTS_POINTER_IE10 =
			window.navigator.msPointerEnabled &&
			!window.PointerEvent &&
			!SUPPORTS_TOUCH,
		SUPPORTS_POINTER =
			(window.PointerEvent || window.navigator.msPointerEnabled) &&
			!SUPPORTS_TOUCH,
		PLUGIN_NS = "TouchSwipe",
		defaults = {
			fingers: 1,
			threshold: 75,
			cancelThreshold: null,
			pinchThreshold: 20,
			maxTimeThreshold: null,
			fingerReleaseThreshold: 250,
			longTapThreshold: 500,
			doubleTapThreshold: 200,
			swipe: null,
			swipeLeft: null,
			swipeRight: null,
			swipeUp: null,
			swipeDown: null,
			swipeStatus: null,
			pinchIn: null,
			pinchOut: null,
			pinchStatus: null,
			click: null,
			tap: null,
			doubleTap: null,
			longTap: null,
			hold: null,
			triggerOnTouchEnd: !0,
			triggerOnTouchLeave: !1,
			allowPageScroll: "auto",
			fallbackToMouseEvents: !0,
			excludedElements: ".noSwipe",
			preventDefaultEvents: !0,
		};
	($.fn.swipe = function (method) {
		var $this = $(this),
			plugin = $this.data(PLUGIN_NS);
		if (plugin && "string" == typeof method) {
			if (plugin[method])
				return plugin[method].apply(
					plugin,
					Array.prototype.slice.call(arguments, 1)
				);
			$.error("Method " + method + " does not exist on jQuery.swipe");
		} else if (plugin && "object" == typeof method)
			plugin.option.apply(plugin, arguments);
		else if (!(plugin || ("object" != typeof method && method)))
			return init.apply(this, arguments);
		return $this;
	}),
		($.fn.swipe.version = VERSION),
		($.fn.swipe.defaults = defaults),
		($.fn.swipe.phases = {
			PHASE_START: PHASE_START,
			PHASE_MOVE: PHASE_MOVE,
			PHASE_END: PHASE_END,
			PHASE_CANCEL: PHASE_CANCEL,
		}),
		($.fn.swipe.directions = {
			LEFT: LEFT,
			RIGHT: RIGHT,
			UP: UP,
			DOWN: DOWN,
			IN: IN,
			OUT: OUT,
		}),
		($.fn.swipe.pageScroll = {
			NONE: NONE,
			HORIZONTAL: HORIZONTAL,
			VERTICAL: VERTICAL,
			AUTO: AUTO,
		}),
		($.fn.swipe.fingers = {
			ONE: 1,
			TWO: 2,
			THREE: 3,
			FOUR: 4,
			FIVE: 5,
			ALL: ALL_FINGERS,
		});
});
