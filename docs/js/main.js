$(function () {
	$("body").addClass("_load");
	$(".front-top-down").click(function () {
		$("html, body").animate(
			{ scrollTop: $(".front-top-down").position().top - 60 },
			600
		);
	});
	if ($(".front-top").length) {
		let indx = 0;
		function titleSliderResize() {
			let w = 0;
			$(".front-top__subtitle-slider span").each(function () {
				w = w < $(this).width() ? $(this).width() : "";
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
		let progress = $(".front-slider__autoplay-circle");
		const swiper = new Swiper(".front-slider", {
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
				nextEl: $(".front-slider__next")[0],
				prevEl: $(".front-slider__prev")[0],
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
					// $(".front-slider__title").removeClass("_prev");
					// $(".front-slider__title._active").addClass("_prev");
					$(".front-slider__title._word-animate")
						.removeClass("_word-animate")
						.addClass("_word-hidden");
					$(".front-slider__title")
						.eq(indx)
						.addClass("_word-animate")
						.removeClass("_word-hidden");
				},
			},
		});
	}
	if ($(".front-about__slider").length) {
		let progress = $(".front-about__slider-autoplay-circle");
		const swiper = new Swiper(".front-about__slider", {
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
				nextEl: $(".front-about__slider-next")[0],
				prevEl: $(".front-about__slider-prev")[0],
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

	if ($(".front-rich__slider ").length) {
		const swiper = new Swiper(".front-rich__slider", {
			slidesPerView: "auto",
			spaceBetween: 20,
			freeMode: true,
			mousewheel: {
				forceToAxis: true,
				invert: false,
			},
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
					let count = th.data("count");
					let duration = th.data("duration")
						? th.data("duration")
						: 2000;
					th.css("min-width", th.width());
					th.animateNumber(
						{
							number: count,
							numberStep: function (now, tween) {
								var floored_number = Math.floor(now),
									target = $(tween.elem);
								if (count == floored_number) {
									th.removeAttr("style");
								}
								target.text(numberWithSpaces(floored_number));
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

function header() {
	let header = $(".header");
	header.removeClass("_header-hidden");
	let prevscroll = $(window).scrollTop();
	// if (isFront) {
	// 	prevscroll = window.innerHeight * 2;
	// }

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

$(function(){})
$(function(){})
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

$(function(){})