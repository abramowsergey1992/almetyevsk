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

$(function(){})
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

					for (let i = 1; i <= data.pages.length; i++) {
						$(".afisha-main .paginator__next").before(
							`<div class="paginator__page ${
								data.pages.now == i ? "_active" : ""
							}">${i}</div>`
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

		$(document).on("click", ".afisha-main .paginator__page ", function () {
			state.page = $(this).text();
			renderAfisha();
		});
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
			let lng = $(".front-top__title-slider  span").length - 1;
			$(".front-top__title-slider  span").removeClass("_prev");
			$(".front-top__title-slider  span._active").addClass("_prev");
			$(".front-top__title-slider  span").removeClass("_active");
			$(".front-top__subtitle-slider  span").removeClass("_prev");
			$(".front-top__subtitle-slider  span._active").addClass("_prev");
			$(".front-top__subtitle-slider  span").removeClass("_active");
			indx = indx == lng ? 0 : indx + 1;

			$(".front-top__title-slider  span").eq(indx).addClass("_active");
			$(".front-top__subtitle-slider  span").eq(indx).addClass("_active");
		}, 2000);
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
			navigation: {
				nextEl: $(".front-persons__next")[0],
				prevEl: $(".front-persons__prev")[0],
			},
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
		setInterval(function () {
			$(".front-persons__swiper").removeClass("_prev");
			$(".front-persons__swiper._active").addClass("_prev");
			$(".front-persons__swiper").removeClass("_active");
			$(".front-persons__title-list color").removeClass("_prev");
			$(".front-persons__title-list color._active").addClass("_prev");
			$(".front-persons__title-list color").removeClass("_active");

			indx = indx == lng ? 0 : indx + 1;

			$(".front-persons__title-list color").eq(indx).addClass("_active");
			$(".front-persons__swiper").eq(indx).addClass("_active");
		}, 1000 * $(".front-persons").data("interval"));
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
								.find(".news-preview__link")
								.text(val.link);
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
								.find(".news-events__link")
								.attr("href", val.link);
						}
						if (val.class) {
							$template.addClass(val.class);
						}
						$("#news-grid").append($template);
					});
					$(".news-main .paginator__page").remove();

					for (let i = 1; i <= data.pages.length; i++) {
						$(".news-main .paginator__next").before(
							`<div class="paginator__page ${
								data.pages.now == i ? "_active" : ""
							}">${i}</div>`
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

		$(document).on("click", ".news-main .paginator__page ", function () {
			state.page = $(this).text();
			renderNews();
		});
		$(document).on("click", ".news-main .paginator__prev ", function () {
			state.page = state.page > 1 ? state.page - 1 : state.page;
		});
		$(document).on("click", ".news-main .paginator__next ", function () {
			state.page != state.pages > 1 ? state.page - 1 : state.page;
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

$(function(){})
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
	AOS.init({
		duration: 700, // values from 0 to 3000, with step 50ms
		easing: "ease", // default easing for AOS animations
		once: true, // whether animation should happen only once - while scrolling down
	});
	function numberWithSpaces(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
	}
	document.addEventListener("aos:in", ({ detail }) => {
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

$(function(){})
$(function(){})
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
		}, 1500);
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
