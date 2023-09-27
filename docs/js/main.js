$(function () {
	if ($(".p404").length) {
		$(".p404").addClass("_circles-animate");
		setTimeout(function () {
			$(".p404__circle").css({
				opacity: 1,
				animation: "none",
			});
			$(document).mousemove(function (event) {
				let p = 1 / (window.innerWidth / event.pageX) - 0.5;
				let i = 0;

				$(".p404__circle").each(function () {
					gsap.to(this, {
						rotation: (4 + i) * p,
						duration: 4,
						ease: "elastic",
					});
					i += 1;
				});
			});
		}, 4000);
	}
});

$(function(){})
$(function () {
	if ($("#contact-map").length) {
		ymaps.ready(function () {
			let center = $("#contact-map").data("coord").split(",");
			console.log(center);
			let myMap = new ymaps.Map(
				"contact-map",
				{
					center: [
						parseFloat(center[0].trim()),
						parseFloat(center[1].trim()),
					],
					controls: ["zoomControl"],
					zoom: 16,
				},
				{
					searchControlProvider: "yandex#search",
				}
			);

			myMap.behaviors.disable("scrollZoom");

			//на мобильных устройствах... (проверяем по userAgent браузера)
			if (
				/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
					navigator.userAgent
				)
			) {
				//... отключаем перетаскивание карты
				myMap.behaviors.disable("drag");
			}
			myPlacemark = new ymaps.Placemark(
				[parseFloat(center[0].trim()), parseFloat(center[1].trim())],
				{
					hintContent: "",
					balloonContent: "",
				},
				{
					iconLayout: "default#image",
					iconImageHref: $("#contact-map").data("marker"),
					iconImageSize: [33, 33],
					iconImageOffset: [-16, -16],
				}
			);
			myMap.geoObjects.add(myPlacemark);
		});
	}
});

$(function () {
	if ($("#afisha-grid").length) {
		// var elements = document.querySelectorAll(".news-mini-block");
		// Stickyfill.add(elements);
		console.log(state);

		$(".afisha-main__filter-head").click(function () {
			let $wrap = $(this).closest(".afisha-main__filter");
			if ($wrap.hasClass("_open")) {
				$wrap.removeClass("_open");
				$wrap.find(".afisha-main__filter-body").slideUp();
			} else {
				$wrap.addClass("_open");
				$wrap.find(".afisha-main__filter-body").slideDown();
			}
		});
		function renderAfisha() {
			console.log("state", state);
			$("#afisha-grid").html("");
			var url = new URL(location.href);
			url.searchParams.set("city", state.city);
			url.searchParams.set("category", state.category);
			url.searchParams.set("date", state.date);
			url.searchParams.set("page", state.page);
			// window.location.search = url.search;
			window.history.pushState({}, "", url.search);
			console.log(url.toString());
			// let filterArray = [...array];
			// let city = $('[name="city"]:checked').val();
			// if (city != "all" && city) {
			// 	filterArray = filterArray.filter(function (elem) {
			// 		return city.toLowerCase() == elem.city.toLowerCase();
			// 	});
			// }
			// if (city != "all" && city) {
			// 	filterArray = filterArray.filter(function (elem) {
			// 		return city.toLowerCase() == elem.city.toLowerCase();
			// 	});
			// }
			$.ajax({
				url: $("#afisha-grid").data("json"),
				data: {
					city: state.city,
					category: state.category,
					date: state.date,
					page: state.page,
				},
				method: "GET",
				headers: {
					"X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr(
						"content"
					),
				},
				context: document.body,
				success: function (data) {
					console.log(data);
					let array = data.items;
					$.each(array, function (key, val) {
						let $template = $("#template .news-preview").clone();
						$template
							.find(".news-preview__img picture")
							.html(`<img src=${val.img} alt=${val.title}/>`);
						$template.find(".news-preview__tags").text(val.city);
						$template.find(".news-preview__date").text(val.date);
						$template.find(".news-preview__time").text(val.time);
						$template.find(".news-preview__title").text(val.title);
						$template.find(".news-preview__link").text(val.link);
						$("#afisha-grid").append($template);
					});
					$(".afisha-main .paginator__page").remove();
					if (data.pages.length <= 1) {
						$(".paginator").addClass("_disable");
					} else {
						$(".paginator").removeClass("_disable");
					}
					for (let i = 1; i <= data.pages.length; i++) {
						$(".afisha-main .paginator__next").before(
							`<div class="paginator__page ${
								data.pages.now == i ? "_active" : ""
							}">${i}</div>`
						);
					}
					if (data.pages.now == 1) {
						$(".afisha-main .paginator__prev ").addClass(
							"_disable"
						);
					} else {
						$(".afisha-main .paginator__prev ").removeClass(
							"_disable"
						);
					}

					if (data.pages.now == data.pages.length) {
						$(".afisha-main .paginator__next ").addClass(
							"_disable"
						);
					} else {
						$(".afisha-main .paginator__next ").removeClass(
							"_disable"
						);
					}
					if (array.length == 0) {
						$("#afisha-grid").html(
							$("#template .news-none ").clone()
						);
					}
				},
				error: function () {},
			});
		}
		$(".afisha-main .paginator__page").remove();

		for (let i = 1; i <= state.pages; i++) {
			$(".afisha-main .paginator__next").before(
				`<div class="paginator__page ${
					state.page == i ? "_active" : ""
				}">${i}</div>`
			);
		}
		if (state.page == 1) {
			$(".afisha-main .paginator__prev ").addClass("_disable");
		} else {
			$(".afisha-main .paginator__prev ").removeClass("_disable");
		}
		if (state.page == state.pages) {
			$(".afisha-main .paginator__next ").addClass("_disable");
		} else {
			$(".afisha-main .paginator__next ").removeClass("_disable");
		}
		$(document).on("click", ".afisha-main .paginator__page ", function () {
			state.page = $(this).text();
			renderAfisha();
		});
		if (state.pages <= 1) {
			$(".paginator").addClass("_disable");
		} else {
			$(".paginator").removeClass("_disable");
		}
		$(document).on("click", ".afisha-main .paginator__prev ", function () {
			state.page = state.page > 1 ? state.page - 1 : state.page;
		});
		$(document).on("click", ".afisha-main .paginator__next ", function () {
			state.page != state.pages > 1 ? state.page - 1 : state.page;
			renderAfisha();
		});
		let dstart, dfinish;
		if (typeof state.date == "object") {
			dstart = `${state.date[0].split(".")[2]}-${
				state.date[0].split(".")[1]
			}-${state.date[0].split(".")[0]}`;

			dfinish = `${state.date[1].split(".")[2]}-${
				state.date[1].split(".")[1]
			}-${state.date[1].split(".")[0]}`;
			console.log(dstart, dfinish);
		}
		new AirDatepicker("#date-calendar", {
			inline: true,
			range: true,
			selectedDates: [dstart, dfinish],
			onSelect({ date, formattedDate, datepicker }) {
				console.log(formattedDate);
				renderAfisha();
				$(".calendar__from").text(formattedDate[0]);
				$(".calendar__to").text(formattedDate[1]);
			},
		});
		$("#afisha-filter-submit ").click(function () {
			if ($(window).width() <= 1024) {
				renderAfisha();
				$(".filters-popup").fadeOut();
			}
		});
		$(document).on("change", ".afisha-main__filters input", function () {
			state.city = $(
				".afisha-main__filters  [name='city']:checked"
			).val();
			state.date = $(
				".afisha-main__filters  [name='date']:checked"
			).val();
			state.category = $(
				".afisha-main__filters  [name='category']:checked"
			).val();
			state.page = $(".afisha-main .paginator__page._active").text();
			if ($(window).width() > 1024) {
				renderAfisha();
			}
		});
		let delay = 600;
		let delayStep = 300;
		$(".afisha-main .news-preview").each(function () {
			let $th = $(this);
			setTimeout(function () {
				$th.removeClass("_opacity");
			}, delay);
			delay += delayStep;
			console.log(delay);
		});

		if ($(window).width() < 1024) {
			$("#afisha-filter-popup-wrap").append($("#afisha-main__filters"));
		} else {
			$("#afisha-main__filters-wrap").append($("#afisha-main__filters"));
		}
		$(window).resize(function () {
			if ($(window).width() < 1024) {
				$("#afisha-filter-popup-wrap").append(
					$("#afisha-main__filters")
				);
			} else {
				$("#afisha-main__filters-wrap").append(
					$("#afisha-main__filters")
				);
			}
		});
		$(`.afisha-main  [name='city'][value='${state.city}']`).prop(
			"checked",
			true
		);
		setTimeout(function () {
			$(`.afisha-main  [name='city'][value='${state.city}']`).prop(
				"checked",
				true
			);
		}, 100);
		$(`.afisha-main  [name='date'][value='${state.date}']`).prop(
			"checked",
			true
		);
		$(`.afisha-main  [name='category'][value='${state.category}']`).prop(
			"checked",
			true
		);
	}
});

$(function () {
	if ($(".showplaces__grid ").length) {
		$(".showplaces__grid ").each(function () {
			$grid = $(this).masonry({
				itemSelector: ".showplaces__item",
				columnWidth: ".showplaces__size",
				percentPosition: true,
			});
			// $grid.imagesLoaded().progress(function () {
			// 	$grid.masonry("layout");
			// });
			setTimeout(function () {
				$grid.masonry("layout");
			}, 1000);
			setTimeout(function () {
				$grid.masonry("layout");
			}, 2000);
			setTimeout(function () {
				$grid.masonry("layout");
			}, 3000);
			setTimeout(function () {
				$grid.masonry("layout");
			}, 4000);
		});
	}
});

$(function () {
	let logo = 1;
	gsap.registerPlugin("MorphSVGPlugin");

	if ($(".about-grid__desc").length) {
		let mh = 0;
		$(".about-grid__desc").removeAttr("css");
		$(".about-grid__desc").each(function () {
			$(this).innerHeight() > mh
				? (mh = $(this).innerHeight())
				: (mh = mh);
		});
		console.log(mh);
		$(".about-grid__desc").css("min-height", mh);
		window.addEventListener(
			"resize",
			function (event) {
				let mh = 0;
				$(".about-grid__desc").removeAttr("css");
				$(".about-grid__desc").each(function () {
					$(this).innerHeight() > mh
						? (mh = $(this).innerHeight())
						: (mh = mh);
				});
				$(".about-grid__desc").css("min-height", mh);
			},
			true
		);
	}
	$("body").addClass("_load");
	$(".front-top-down").click(function () {
		$("html, body").animate(
			{ scrollTop: $(".front-top-down").position().top - 60 },
			600
		);
	});
	if ($(".front-news__scroll").length) {
		$(".front-news__right-btn-down").click(function () {
			$(".front-news__scroll");
		});
		$(".front-news__right-btn-down").click(function () {
			$(".front-news__scroll").animate(
				{ scrollTop: $(".front-news__scroll").scrollTop() + 200 },
				600
			);
		});
		$(".front-news__scroll").scroll(function () {
			console.log($(this).scrollTop());
			if (
				$(".front-news__right-grid").outerHeight() - 100 <=
				$(".front-news__scroll").outerHeight() + $(this).scrollTop()
			) {
				$(".front-news__right-btn-down").fadeOut();
			} else {
				$(".front-news__right-btn-down").fadeIn();
			}
		});
	}

	if ($(".front-top").length) {
		var controller = new ScrollMagic.Controller();
		var scene = new ScrollMagic.Scene({
			trigger: 0,
			duration: window.innerHeight,
		})
			// animate color and top border in relation to scroll position
			.setTween(document.querySelector(".front-top-down img"), {
				rotate: 180,
			}) // the tween durtion can be omitted and defaults to 1
			// .addIndicators({ name: "2 (duration: 300)" }) // add indicators (requires plugin)
			.addTo(controller);

		let indx = 0;
		function titleSliderResize() {
			let w = 0;
			$(".front-top__subtitle-slider span").each(function () {
				w = w < $(this).width() ? $(this).width() : w;
				console.log($(this).width(), w);
			});
			$(".front-top__subtitle-slider").css("min-width", w);
			$(".front-top__title-slider").css(
				"min-width",
				$(".front-top__title-slider span").first().width()
			);
		}
		titleSliderResize();
		window.addEventListener(
			"resize",
			function (event) {
				titleSliderResize();
			},
			true
		);
		setInterval(function () {
			let lng = 6;
			$(".front-top__title-slider  span").removeClass("_prev");
			$(".front-top__title-slider  span._active").addClass("_prev");
			$(".front-top__title-slider  span").removeClass("_active");
			$(".front-top__subtitle-slider  span").removeClass("_prev");
			$(".front-top__subtitle-slider  span._active").addClass("_prev");
			$(".front-top__subtitle-slider  span").removeClass("_active");
			indx = indx == lng ? 1 : indx + 1;
			gsap.to("#front-top__title-symbol", {
				duration: 1,
				morphSVG: { shape: "#front-top__title-symbol-" + indx },
			});
			$(".front-top__title-slider  span")
				.eq(indx - 1)
				.addClass("_active");
			$(".front-top__subtitle-slider  span")
				.eq(indx - 1)
				.addClass("_active");
		}, 3000);
	}
	if ($(".full-slider").length) {
		let progress = $(".full-slider__autoplay-circle");
		const swiper = new Swiper(".full-slider", {
			slidesPerView: 1,
			loop: true,
			spaceBetween: 0,
			speed: 900,
			autoplay: {
				delay: 5000,
				disableOnInteraction: false,
			},
			grabCursor: true,
			effect: "creative",
			creativeEffect: {
				prev: {
					translate: ["-20%", 0, -1],
				},
				next: {
					translate: ["100%", 0, 0],
				},
			},
			navigation: {
				nextEl: $(".full-slider__next")[0],
				prevEl: $(".full-slider__prev")[0],
			},
			on: {
				autoplayTimeLeft: function (swiper, timeLeft, percentage) {
					progress.css(
						"stroke-dasharray",
						(1 - percentage) * 70 + "px, 70px"
					);
				},
				slideChange: function (swiper) {
					let indx = swiper.realIndex;
					// $(".full-slider__title").removeClass("_prev");
					// $(".full-slider__title._active").addClass("_prev");
					$(".full-slider__title._word-animate")
						.removeClass("_word-animate")
						.addClass("_word-hidden");
					$(".full-slider__title")
						.eq(indx)
						.addClass("_word-animate")
						.removeClass("_word-hidden");
				},
			},
		});
	}
	if ($(".about-grid__slider").length) {
		let progress = $(".about-grid__slider-autoplay-circle");
		const swiper = new Swiper(".about-grid__slider", {
			slidesPerView: 1,
			loop: true,
			spaceBetween: 0,
			speed: 900,
			autoplay: {
				delay: 5000,
				disableOnInteraction: false,
			},
			creativeEffect: {
				prev: {
					translate: ["-20%", 0, -1],
				},
				next: {
					translate: ["100%", 0, 0],
				},
			},
			grabCursor: true,
			navigation: {
				nextEl: $(".about-grid__slider-next")[0],
				prevEl: $(".about-grid__slider-prev")[0],
			},
			on: {
				autoplayTimeLeft: function (swiper, timeLeft, percentage) {
					progress.css(
						"stroke-dasharray",
						(1 - percentage) * 70 + "px, 70px"
					);
				},
			},
		});
	}

	if ($(".items-slider__slider ").length) {
		const swiper = new Swiper(".items-slider__slider", {
			slidesPerView: "auto",
			spaceBetween: 20,
			freeMode: true,
			navigation: {
				nextEl: $(".items-slider__next")[0],
				prevEl: $(".items-slider__prev")[0],
			},
			mousewheel: {
				forceToAxis: true,
				invert: false,
			},
		});
		$(".items-slider__prev-zona").each(function () {
			let wrapper = $(this);

			let cursor = wrapper.find(".items-slider__prev");
			wrapper.on("mousemove", function (e) {
				console.log("move");
				let position = $(this).offset();
				let left = e.pageX - position.left - 76 / 2;
				let top = e.pageY - position.top - 76 / 2;

				gsap.to(cursor, 0.03, {
					left: left,
					top: top,
					ease: Power4.easOut,
				});
			});
		});
		$(".items-slider__next-zona").each(function () {
			let wrapper = $(this);

			let cursor = wrapper.find(".items-slider__next");
			wrapper.on("mousemove", function (e) {
				console.log("move");
				let position = $(this).offset();
				let left = e.pageX - position.left - 76 / 2;
				let top = e.pageY - position.top - 76 / 2;

				gsap.to(cursor, 0.03, {
					left: left,
					top: top,
					ease: Power4.easOut,
				});
			});
		});
	}
	if ($(".front-persons__swiper").length) {
		const swiper = new Swiper(".front-persons__swiper", {
			slidesPerView: "auto",
			spaceBetween: 16,
			freeMode: true,
			mousewheel: { forceToAxis: true, invert: false },
			// navigation: {
			// 	nextEl: $(".front-persons__next")[0],
			// 	prevEl: $(".front-persons__prev")[0],
			// },
			breakpoints: {
				1400: {
					slidesPerView: 4,
				},
				1700: {
					slidesPerView: 5,
				},
			},
		});
		let indx = 0;
		let lng = $(".front-persons__swiper").length - 1;

		$(".front-persons__prev").click(function () {
			$(".front-persons__swiper").removeClass("_prev");
			$(".front-persons__swiper._active").addClass("_prev");
			$(".front-persons__swiper").removeClass("_active");
			$(".front-persons__title-list color").removeClass("_prev");
			$(".front-persons__title-list color._active").addClass("_prev");
			$(".front-persons__title-list color").removeClass("_active");

			indx = indx == 0 ? lng : indx - 1;

			$(".front-persons__title-list color").eq(indx).addClass("_active");
			$(".front-persons__swiper").eq(indx).addClass("_active");
		});
		$(".front-persons__next").click(function () {
			$(".front-persons__swiper").removeClass("_prev");
			$(".front-persons__swiper._active").addClass("_prev");
			$(".front-persons__swiper").removeClass("_active");
			$(".front-persons__title-list color").removeClass("_prev");
			$(".front-persons__title-list color._active").addClass("_prev");
			$(".front-persons__title-list color").removeClass("_active");

			indx = indx == lng ? 0 : indx + 1;

			$(".front-persons__title-list color").eq(indx).addClass("_active");
			$(".front-persons__swiper").eq(indx).addClass("_active");
		});
	}
	if ($(".plan-slider").length) {
		const swiper = new Swiper(".plan-slider", {
			slidesPerView: 1,
			spaceBetween: 16,
			mousewheel: { forceToAxis: true, invert: false },
			navigation: {
				nextEl: $(".plan-slider__next")[0],
				prevEl: $(".plan-slider__prev")[0],
			},
			breakpoints: {
				700: {
					slidesPerView: 2,
				},
				1450: {
					slidesPerView: "auto",
				},
			},
		});
		$(".plan-slider__prev-zona").each(function () {
			let wrapper = $(this);

			let cursor = wrapper.find(".plan-slider__prev");
			wrapper.on("mousemove", function (e) {
				console.log("move");
				let position = $(this).offset();
				let left = e.pageX - position.left - 76 / 2;
				let top = e.pageY - position.top - 76 / 2;

				gsap.to(cursor, 0.03, {
					left: left,
					top: top,
					ease: Power4.easOut,
				});
			});
		});
		$(".plan-slider__next-zona").each(function () {
			let wrapper = $(this);

			let cursor = wrapper.find(".plan-slider__next");
			wrapper.on("mousemove", function (e) {
				console.log("move");
				let position = $(this).offset();
				let left = e.pageX - position.left - 76 / 2;
				let top = e.pageY - position.top - 76 / 2;

				gsap.to(cursor, 0.03, {
					left: left,
					top: top,
					ease: Power4.easOut,
				});
			});
		});
	}
	if ($(".quiz").length) {
		const swiper = new Swiper(".quiz__swiper", {
			slidesPerView: 1,
			loop: true,
			allowTouchMove: false,
			spaceBetween: 16,
		});
		$(document).on("click", ".quiz__answer-next", function () {
			swiper.slideNext();
			$(".quiz__answer").find("input").prop("checked", false);
			$(".quiz__answer").removeClass("_result");
		});
		$(document).on("change", ".quiz__quest-radio  input", function () {
			let slide = $(this).closest(".quiz__answer");
			slide.attr("data-answer", $(this).data("answer"));
			slide.addClass("_result");
		});
	}
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

$(function(){})
$(function () {
	let delay = 2000;
	let delayStep = 300;
	$(".galleries-grid__item,.gallery-grid__item").each(function () {
		let $th = $(this);
		setTimeout(function () {
			$th.addClass("_visible");
		}, delay);
		delay += delayStep;
		console.log(delay);
	});
	if ($(".gallery-grid").length) {
		$grid = $(".gallery-grid ").masonry({
			itemSelector: ".gallery-grid__item",
			columnWidth: ".gallery-grid__size",
			percentPosition: true,
			// fitWidth: true,
			gutter: 16,
		});
		$grid.imagesLoaded().progress(function () {
			$grid.masonry("layout");
		});
	}
	if ($(".galleries-grid").length) {
		$grid = $(".galleries-grid ").masonry({
			itemSelector: ".galleries-grid__item",
			columnWidth: ".galleries-grid__size",
			percentPosition: true,
			// fitWidth: true,
			gutter: 16,
		});
		$grid.imagesLoaded().progress(function () {
			$grid.masonry("layout");
		});
	}
});

$(function () {
	if ($(".legend-1").length) {
		var controller = new ScrollMagic.Controller();
		var scene = new ScrollMagic.Scene({
			triggerElement: ".legend-1__row2",
			ofset: 100,
			duration: window.innerHeight * 0.5,
		})
			.setTween(document.querySelector(".legend-1__img"), {
				y: 0,
			})
			.addTo(controller);
		var scene2 = new ScrollMagic.Scene({
			triggerElement: ".legend-1__row2",
			ofset: 100,
			duration: window.innerHeight * 0.5,
		})
			.setTween(document.querySelector(".legend-1__img-2"), {
				y: 0,
			})
			.addTo(controller);
	}
});

$(function () {
	if ($("#news-grid").length) {
		function renderNews() {
			console.log("state", state);
			$("#news-grid").html("");
			var url = new URL(location.href);
			url.searchParams.set("city", state.city);
			url.searchParams.set("sort", state.date);
			url.searchParams.set("page", state.page);
			// window.location.search = url.search;
			window.history.pushState({}, "", url.search);
			console.log(url.toString());
			// let filterArray = [...array];
			// let city = $('[name="city"]:checked').val();
			// if (city != "all" && city) {
			// 	filterArray = filterArray.filter(function (elem) {
			// 		return city.toLowerCase() == elem.city.toLowerCase();
			// 	});
			// }
			// if (city != "all" && city) {
			// 	filterArray = filterArray.filter(function (elem) {
			// 		return city.toLowerCase() == elem.city.toLowerCase();
			// 	});
			// }
			$(".news-head__sort").removeClass("_active");
			$(".news-head__sort[data-sort=" + state.sort + "]").addClass(
				"_active"
			);
			$.ajax({
				url: $("#news-grid").data("json"),
				data: {
					city: state.city,
					sort: state.sort,
					page: state.page,
				},
				method: "GET",
				headers: {
					"X-CSRF-TOKEN": $('meta[name="csrf-token"]').attr(
						"content"
					),
				},
				context: document.body,
				success: function (data) {
					let array = data.items;
					$.each(array, function (key, val) {
						let $template;
						console.log(val, val.class);
						if (val.type == "news") {
							$template = $("#template .news-preview").clone();
							$template
								.find(".news-preview__img picture")
								.html(`<img src=${val.img} alt=${val.title}/>`);
							$template
								.find(".news-preview__tags")
								.text(val.city);
							$template
								.find(".news-preview__date")
								.text(val.date);
							$template
								.find(".news-preview__time")
								.text(val.time);
							$template
								.find(".news-preview__title")
								.text(val.title);
							$template
								.find(".news-preview__title")
								.attr("href", val.link);
							$template
								.find(".news-preview__link")
								.text(val.link);
							$template
								.find(".news-preview__link")
								.attr("href", val.link);
						}
						if (val.type == "event") {
							$template = $("#template .news-events").clone();
							$template
								.find(".news-events__img  picture")
								.html(`<img src=${val.img} alt=${val.title}/>`);

							$template.find(".news-events__date").text(val.date);

							$template
								.find(".news-events__title")
								.text(val.title);
							$template
								.find(".news-events__title")
								.attr("href", val.link);
							$template
								.find(".news-events__link")
								.attr("href", val.link);
						}
						if (val.class) {
							$template.addClass(val.class);
						}
						$("#news-grid").append($template);
					});
					$(".news-main .paginator__page").remove();
					if (data.pages.length <= 1) {
						$(".paginator").addClass("_disable");
					} else {
						$(".paginator").removeClass("_disable");
					}
					for (let i = 1; i <= data.pages.length; i++) {
						$(".news-main .paginator__next").before(
							`<div class="paginator__page ${
								data.pages.now == i ? "_active" : ""
							}">${i}</div>`
						);
					}
					console.log(data.pages.length, data.pages.now);
					if (data.pages.now == 1) {
						$(".news-main .paginator__prev ").addClass("_disable");
					} else {
						$(".news-main .paginator__prev ").removeClass(
							"_disable"
						);
					}

					if (data.pages.now == data.pages.length) {
						$(".news-main .paginator__next ").addClass("_disable");
					} else {
						$(".news-main .paginator__next ").removeClass(
							"_disable"
						);
					}
					if (array.length == 0) {
						$("#news-grid").html(
							$("#template .news-none ").clone()
						);
					}
				},
				error: function () {},
			});
		}
		$(".news-main .paginator__page").remove();

		for (let i = 1; i <= state.pages; i++) {
			$(".news-main .paginator__next").before(
				`<div class="paginator__page ${
					state.page == i ? "_active" : ""
				}">${i}</div>`
			);
		}
		if (state.page == 1) {
			$(".news-main .paginator__prev ").addClass("_disable");
		} else {
			$(".news-main .paginator__prev ").removeClass("_disable");
		}
		if (state.page == state.pages) {
			$(".news-main .paginator__next ").addClass("_disable");
		} else {
			$(".news-main .paginator__next ").removeClass("_disable");
		}
		if (state.pages <= 1) {
			$(".paginator").addClass("_disable");
		} else {
			$(".paginator").removeClass("_disable");
		}
		$(document).on("click", ".news-main .paginator__page ", function () {
			state.page = $(this).text();
			renderNews();
		});
		$(document).on("click", ".news-main .paginator__prev ", function () {
			state.page = state.page > 1 ? state.page - 1 : state.page;
		});
		$(document).on("click", ".news-main .paginator__next ", function () {
			state.page != state.pages > 1 ? state.page + 1 : state.page;
			renderNews();
		});

		$(".news-head__sort").click(function () {
			$(".news-head__sort").removeClass("_active");
			$(this).addClass("_active");
			state.city = $(
				".news-city-filter__city[name='city']:checked"
			).val();
			state.sort = $(".news-head__sort._active").data("sort");
			state.page = $(".news-main .paginator__page._active").text();
			renderNews();
		});
		$(document).on("change", ".news-city-filter input", function () {
			state.city = $(
				".news-city-filter__city[name='city']:checked"
			).val();
			state.sort = $(".news-head__sort._active").data("sort");
			state.page = $(".news-main .paginator__page._active").text();
			renderNews();
		});
		let delay = 600;
		let delayStep = 300;
		$(".news-main .news-preview,.news-main .news-event").each(function () {
			let $th = $(this);
			setTimeout(function () {
				$th.removeClass("_opacity");
			}, delay);
			delay += delayStep;
			console.log(delay);
		});

		$(`.news-main  [name='city'][value='${state.city}']`).prop(
			"checked",
			true
		);
		setTimeout(function () {
			$(`.news-main  [name='city'][value='${state.city}']`).prop(
				"checked",
				true
			);
		}, 100);
		$(".news-head__sort").removeClass("_active");
		$(`.news-head__sort[data-sort="${state.sort}"]`).addClass("_active");
	}
});

$(function () {
	$(".history-slider__item-img").click(function () {
		console.log("xxx");
	});
	if ($(".history-slider").length) {
		const ele = document.querySelector(".history-slider");
		ele.style.cursor = "grab";

		let pos = { top: 0, left: 0, x: 0, y: 0 };

		const mouseDownHandler = function (e) {
			ele.style.cursor = "grabbing";
			ele.style.userSelect = "none";

			pos = {
				left: ele.scrollLeft,
				top: ele.scrollTop,
				// Get the current mouse position
				x: e.clientX,
				y: e.clientY,
			};

			document.addEventListener("mousemove", mouseMoveHandler);
			document.addEventListener("mouseup", mouseUpHandler);
		};

		const mouseMoveHandler = function (e) {
			// How far the mouse has been moved
			const dx = e.clientX - pos.x;
			const dy = e.clientY - pos.y;

			// Scroll the element
			ele.scrollTop = pos.top - dy;
			ele.scrollLeft = pos.left - dx;
		};

		const mouseUpHandler = function () {
			ele.style.cursor = "grab";
			ele.style.removeProperty("user-select");

			document.removeEventListener("mousemove", mouseMoveHandler);
			document.removeEventListener("mouseup", mouseUpHandler);
		};

		// Attach the handler
		ele.addEventListener("mousedown", mouseDownHandler);
	}
});

$(function(){})
$(function(){})
$(function () {
	AOS.init({
		duration: 700, // values from 0 to 3000, with step 50ms
		easing: "ease", // default easing for AOS animations
		once: true, // whether animation should happen only once - while scrolling down
	});
	function numberWithSpaces(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
	}
	document.addEventListener("aos:in", ({ detail }) => {
		$(detail).addClass("_events-none");
		setTimeout(function () {
			$(detail).removeClass("_events-none");
		}, 800);
		console.log($(detail).find(".words"));
		$(detail).find(".words").addClass("_word-animate");
		if ($(detail).find("[data-count]").length) {
			console.log(detail, $(detail).find("[data-count]"));
			$(detail)
				.find("[data-count]")
				.each(function () {
					let th = $(this);
					let divider = th.data("divider");
					let count = th.data("count");
					let duration = th.data("duration")
						? th.data("duration")
						: 3000;
					th.css("min-width", th.outerWidth());
					th.css("max-width", th.outerWidth());
					th.animateNumber(
						{
							number: count,
							numberStep: function (now, tween) {
								var floored_number = Math.floor(now),
									target = $(tween.elem);
								if (count == floored_number) {
									th.removeAttr("style");
								}
								if (divider == false) {
									target.text(floored_number);
								} else {
									target.text(
										numberWithSpaces(floored_number)
									);
								}
							},
						},
						{
							easing: "swing",
							duration: duration,
						}
					);
				});
		}
	});
});

$(function(){})
$(function () {
	$(".video-hover-play").hover(
		function () {
			this.play();
		},
		function () {
			this.pause();
		}
	);
	if ($(".gallery-block__slider ").length) {
		$(".gallery-block__slider ").each(function () {
			let progress = $(this).find(
				".gallery-block__slider-autoplay-circle"
			);
			let th = $(this);
			const swiper = new Swiper(this, {
				slidesPerView: 1,
				loop: true,
				spaceBetween: 0,
				speed: 900,
				autoplay: {
					delay: 5000,
				},
				grabCursor: true,
				navigation: {
					nextEl: th.find(".gallery-block__slider-next")[0],
					prevEl: th.find(".gallery-block__slider-prev")[0],
				},
				on: {
					autoplayTimeLeft: function (swiper, timeLeft, percentage) {
						progress.css(
							"stroke-dasharray",
							(1 - percentage) * 70 + "px, 70px"
						);
					},
				},
			});
		});
	}
});

$(function(){})
$(function () {
	$(".news-events__slider").each(function () {
		let th = $(this);
		console.log(th.find(".news-events__slider-pagi"));
		const swiper = new Swiper(this, {
			speed: 400,
			setWrapperSize: true,
			spaceBetween: 0,
			pagination: {
				el: th.find(".news-events__slider-pagi")[0],
				type: "bullets",
				clickable: true,
			},
			autoplay: {
				delay: 5000,
			},
		});
	});
});

function header() {
	let header = $(".header");
	header.removeClass("_header-hidden");
	let prevscroll = $(window).scrollTop();
	// if (isFront) {
	// 	prevscroll = window.innerHeight * 2;
	// }
	$(".header__burger").click(function () {
		$("body").toggleClass("_open-header-menu");
	});

	if (prevscroll > 5) {
		header.addClass("_bg");
	} else {
		header.removeClass("_bg");
	}
	$(window).scroll(() => {
		let currentScroll = $(window).scrollTop();

		if (currentScroll > 5) {
			header.addClass("_bg");
		} else {
			header.removeClass("_bg");
		}
		if (currentScroll > prevscroll) {
			header.addClass("_header-hidden");
		} else {
			header.removeClass("_header-hidden");
		}
		if (currentScroll <= 10) {
			header.removeClass("_header-hidden");
		}
		prevscroll = currentScroll;
	});
}
$(function () {
	header();
});

$(function(){})
$(function(){})
$(function () {
	$("body").addClass("_preloader-open");
	function preloaderOut() {
		$(".preloader").addClass("_fadeup");
		setTimeout(function () {
			$(".preloader").fadeOut();
			setCookie("load", true);
			setTimeout(function () {
				$("body").removeClass("_preloader-open");
			}, 500);
		}, 1000);
	}

	if ($(".preloader__desc").length) {
		let indx = 0;
		function titleSliderResize() {
			let w = 0;
			$(".preloader__desc-slider  span").each(function () {
				w = w < $(this).width() ? $(this).width() : w;
				console.log($(this).width(), w);
			});
			$(".preloader__desc-slider ").css("min-width", w);
			$(".preloader__desc-slider ").css(
				"min-width",
				$(".preloader__desc-slider  span").first().width()
			);
		}
		titleSliderResize();
		window.addEventListener(
			"resize",
			function (event) {
				titleSliderResize();
			},
			true
		);
		setInterval(function () {
			let lng = $(".preloader__desc-slider   span").length - 1;
			$(".preloader__desc-slider   span").removeClass("_prev");
			$(".preloader__desc-slider  span._active").addClass("_prev");
			$(".preloader__desc-slider   span").removeClass("_active");
			indx = indx == lng ? 0 : indx + 1;

			$(".preloader__desc-slider   span").eq(indx).addClass("_active");
		}, 2000);
	}
	$(".preloader").addClass("_load");
	$(".header__city").click(function () {
		$(".preloader").removeClass(
			" _load _circles-animate _content _city _fadeup"
		);
		$(".preloader").fadeIn(function () {
			$(".preloader").addClass("_load");
		});
		$("body").addClass("_preloader-open");
		setTimeout(function () {
			$(".preloader").addClass("_circles-animate");
			let delay = 0;

			// $(".preloader__circle").each(function () {
			// 	gsap.to(this, {
			// 		rotation: 0,
			// 		delay: delay,
			// 		duration: 10,
			// 		ease: "elastic",
			// 	});
			// 	delay += 0.2;
			// });
			if (isCityChange) {
				setTimeout(function () {
					$(".preloader").addClass("_content");
				}, 1500);

				setTimeout(function () {
					$(".preloader").addClass("_city");
				}, 3000);

				setTimeout(function () {
					$(".header").addClass("_opacity");
				}, 3500);
			} else {
				setTimeout(function () {
					preloaderOut();
				}, 1000);
			}

			setTimeout(function () {
				$(".preloader__circle").attr("style", "");
			}, 4000);
		}, 500);
	});
	setTimeout(function () {
		$(".preloader").addClass("_circles-animate");
		let delay = 0;

		$(".preloader__circle").each(function () {
			gsap.to(this, {
				rotation: 0,
				delay: delay,
				duration: 10,
				ease: "elastic",
			});
			delay += 0.2;
		});
		if (isCityChange) {
			setTimeout(function () {
				$(".preloader").addClass("_content");
			}, 1500);

			setTimeout(function () {
				$(".preloader").addClass("_city");
			}, 3000);

			setTimeout(function () {
				$(".header").addClass("_opacity");
			}, 3500);
			$(".preloader").on("mousewheel", function (e) {
				if (e.originalEvent.wheelDelta / 120 > 0) {
					console.log("up");
				} else {
					preloaderOut();
				}
			});
			$(".preloader").on("DOMMouseScroll", function (e) {
				if (e.originalEvent.wheelDelta / 120 > 0) {
					console.log("up");
				} else {
					preloaderOut();
				}
			});

			$(".preloader").swipe({
				preventDefaultEvents: false,
				//Generic swipe handler for all directions
				swipe: function (
					event,
					direction,
					distance,
					duration,
					fingerCount,
					fingerData
				) {
					if (distance >= 50) {
						if (direction == "up") {
							preloaderOut();
						}
					}
				},
			});
		} else {
			setTimeout(function () {
				preloaderOut();
			}, 1000);
		}
		$(".preloader__down").click(function () {
			preloaderOut();
		});
		setTimeout(function () {
			$(".preloader__circle").css({
				opacity: 1,
				animation: "none",
			});
			$(document).mousemove(function (event) {
				let p = 1 / (window.innerWidth / event.pageX) - 0.5;
				let i = 0;

				$(".preloader__circle").each(function () {
					gsap.to(this, {
						rotation: (4 + i) * p,
						duration: 4,
						ease: "elastic",
					});
					i += 1;
				});
			});
		}, 4000);
	}, 500);
});

// $(function () {
// 	let y = 0;
// 	let controller = new ScrollMagic.Controller({
// 		refreshInterval: 0,
// 	});

// 	let scrollTag = document.querySelector("#pagescroll");
// 	let scroll = Scrollbar.init(scrollTag);

// 	let isChrome =
// 		/Chrome/.test(navigator.userAgent) &&
// 		/Google Inc/.test(navigator.vendor);

// 	console.log("is Chrome ? ", isChrome);
// 	// update scrollY controller
// 	if (isChrome) {
// 		controller.scrollPos(function () {
// 			return y;
// 		});
// 	}

// 	// let scrollHeader = 50;
// 	// if ($(".front-top").length) {
// 	// 	scrollHeader = $(".front-top").outerHeight();
// 	// }
// 	// scrollTag.setAttribute("scroll", y);

// 	// if (y >= scrollHeader) {
// 	// 	$(".header").addClass("_not-top");
// 	// } else {
// 	// 	$(".header").removeClass("_not-top");
// 	// }

// 	// $(window).scroll(function () {
// 	// 	if ($(this).scrollTop() >= scrollHeader) {
// 	// 		$(".header").addClass("_not-top");
// 	// 	} else {
// 	// 		$(".header").removeClass("_not-top");
// 	// 	}
// 	// });
// 	// listener smooth-scrollbar, update controller
// 	scroll.addListener(function (status) {
// 		y = status.offset.y;
// 		scrollTag.setAttribute("scroll", y);
// 		// console.log("y", y, scrollHeader);
// 		// if (y >= scrollHeader) {
// 		// 	$(".header").addClass("_not-top");
// 		// } else {
// 		// 	$(".header").removeClass("_not-top");
// 		// }
// 		if (isChrome) {
// 			controller.update(true);
// 		} else {
// 			scenes.forEach(function (scene) {
// 				scene.refresh();
// 			});
// 		}
// 		// if (
// 		// 	y + window.innerHeight >=
// 		// 	$(".page").innerHeight() - $(".footer").innerHeight() - 50
// 		// ) {
// 		// 	$(".page").addClass("_page-end ");
// 		// } else {
// 		// 	$(".page").removeClass("_page-end ");
// 		// }
// 	});
// });

$(function () {
	$(".words").each(function () {
		let th = $(this);
		var words = th.text().split(" ");
		th.empty();
		$.each(words, function (i, v) {
			th.append($("<span>").text(v));
			th.append(" ");
		});
	});
});

$(function () {
	if ($(".overfolow-x").length) {
		$(".overfolow-x").each(function () {
			let $th = $(this);

			$th.html(
				`<div class="overfolow-x__scroll"><div><div class="overfolow-x__size">${$th.html()}</div></div></div>`
			);
			$th.append(
				'<div class="overfolow-x__prev"><svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.8594 0.999911L20.0191 7.15962M20.0191 7.15962L13.8594 13.3193M20.0191 7.15962L-2.6925e-07 7.15962" stroke="#D0B787" stroke-width="2"/></svg></div>'
			);
			$th.append(
				'<div class="overfolow-x__next"><svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.8594 0.999911L20.0191 7.15962M20.0191 7.15962L13.8594 13.3193M20.0191 7.15962L-2.6925e-07 7.15962" stroke="#D0B787" stroke-width="2"/></svg></div>'
			);
			let $size = $th.find(".overfolow-x__size");
			let $scroll = $th.find(".overfolow-x__scroll");
			let $prev = $th.find(".overfolow-x__prev");
			let $next = $th.find(".overfolow-x__next");
			$next.click(function () {
				$scroll.animate(
					{ scrollLeft: $scroll.scrollLeft() + 150 },
					"slow"
				);
			});
			$prev.click(function () {
				$scroll.animate(
					{ scrollLeft: $scroll.scrollLeft() - 150 },
					"slow"
				);
			});
			$th.find(".overfolow-x__scroll").scroll(function () {
				if ($scroll.scrollLeft() >= 50) {
					$prev.addClass("_active");
				} else {
					$prev.removeClass("_active");
				}

				if (
					$scroll.scrollLeft() + $size.innerWidth() <=
					$scroll[0].scrollWidth - 50
				) {
					$next.addClass("_active");
				} else {
					$next.removeClass("_active");
				}
			});
			$th.find(".overfolow-x__scroll").trigger("scroll");
		});
	}
	if ($(".one-img-slider ").length) {
		$(".one-img-slider ").each(function () {
			let progress = $(this).find(
				".one-img-slider__slider-autoplay-circle"
			);
			let between = $(this).find(".one-img-slider__desc").length ? 16 : 0;
			let th = $(this);
			const swiper = new Swiper(this, {
				slidesPerView: 1,
				loop: true,
				spaceBetween: between,
				speed: 900,
				autoplay: {
					delay: 5000,
				},
				grabCursor: true,
				navigation: {
					nextEl: th.find(".one-img-slider__next")[0],
					prevEl: th.find(".one-img-slider__prev")[0],
				},
				on: {
					autoplayTimeLeft: function (swiper, timeLeft, percentage) {
						progress.css(
							"stroke-dasharray",
							(1 - percentage) * 70 + "px, 70px"
						);
					},
				},
			});
			$(this)
				.find(".one-img-slider__footer")
				.css({
					bottom: "initial",
					top: $(this).find(".one-img-slider__img").height() - 55,
				});
		});
	}
});

$(function () {
	$(".popup-slider__swiper").each(function () {
		const swiper = new Swiper(this, {
			speed: 400,
			setWrapperSize: true,
			observeParents: true,
			observer: true,
			spaceBetween: 50,
		});
	});
	$(".popup-slider__overlay, .popup-slider__close").click(function () {
		$(".popup-slider").fadeOut();
		$("body").removeClass("_no-scroll");
	});
	$("[data-popupslider]").click(function () {
		let id = $(this).data("popupslider").split("|")[0];
		let slide = $(this).data("popupslider").split("|")[1];
		if ($(id).length) {
			$("body").addClass("_no-scroll");
			$(id).fadeIn();

			$(id).find(".popup-slider__swiper")[0].swiper.slideTo(slide);
		}
	});
	$("[data-popup]").click(function () {
		let id = $(this).data("popup");
		if ($(id).length) {
			$("body").addClass("_no-scroll");
			$(id).fadeIn();
		}
	});

	$(".popup__overlay, .popup__close").click(function () {
		$(".popup").fadeOut();
		$("body").removeClass("_no-scroll");
	});
	$(".filters-popup__overlay, .filters-popup__close").click(function () {
		$(".filters-popup").fadeOut();
		$("body").removeClass("_no-scroll");
	});
});
