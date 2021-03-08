import { BehaviorSubject, of , Subject } from 'rxjs';
import { filter, finalize, first, map } from 'rxjs/operators';

export default class IntersectionService {

	static observer() {
		if (!this.observer_) {
			this.readySubject_ = new BehaviorSubject(false);
			this.observerSubject_ = new Subject();
			this.observer_ = new IntersectionObserver(entries => {
				this.observerSubject_.next(entries);
			});
		}
		return this.observer_;
	}

	static intersection$(node) {
		if ('IntersectionObserver' in window) {
			const observer = this.observer();
			observer.observe(node);
			return this.observerSubject_.pipe(
				// tap(entries => console.log(entries.length)),
				map(entries => entries.find(entry => entry.target === node)),
				// tap(entry => console.log('IntersectionService.intersection$', entry)),
				filter(entry => entry !== undefined && entry.isIntersecting), // entry.intersectionRatio > 0
				first(),
				finalize(() => observer.unobserve(node)),
			);
		} else {
			return of({ target: node });
		}

		/*
		function observer() {
			if ('IntersectionObserver' in window) {
				return new IntersectionObserver(entries => {
					entries.forEach(function(entry) {
						if (entry.isIntersecting) {
							entry.target.classList.add('appear');
						}
					})
				});
			} else {
				return { observe: function(node) { node.classList.add('appear')}, unobserve: function() {} };
			}
		}
		observer.observe(node);
		observer.unobserve(node);
		*/

	}

}
