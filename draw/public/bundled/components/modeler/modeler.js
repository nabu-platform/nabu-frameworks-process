Vue.view("process-modeler-component", {
	ready: function() {
		this.draw();
	},
	data: function() {
		return {
			model: {
				states: []
			},
			svg: null,
			selected: {
				type: null,
				target: null,
				group: null
			},
			colors: [{
				name: "blue",
				border: "#8EA7E9",
				background: "#E5E0FF",
				text: "#7286D3"
			}, {
				name: "orange",
				border: "#FF9F9F",
				background: "#FCDDB0", // FFFAD7
				text: "#E97777"
			}],
			// the offset of the draggable rectangle to resize
			draggableOffset: 10
		}	
	},
	watch: {
		selected: function(newValue, oldValue) {
			if (oldValue) {
				var element = oldValue.node().querySelector(":scope > rect");	
				element.style.strokeWidth = 1;
			}
			// we want to increase the border of the rectangle
			var element = newValue.node().querySelector(":scope > rect");
			element.style.strokeWidth = 2;
		}
	},
	computed: {
		maxWidth: function() {
			return this.model.states.reduce(function(current, state) {
				return Math.max(current, state.styling.x + state.styling.width);
			}, 0);
		},
		maxHeight: function() {
			return this.model.states.reduce(function(current, state) {
				return Math.max(current, state.styling.y + state.styling.height);
			}, 0);
		}
	},
	methods: {
		select: function(type, target, group) {
			// visually deselect the previous entry
			if (this.selected.group) {
				var element = this.selected.group.node().querySelector(":scope > rect");	
				element.style.strokeWidth = 1;
			}
			// visually select the new group
			if (group) {
				var element = group.node().querySelector(":scope > rect");
				element.style.strokeWidth = 3;
			}
			this.selected.type = type;
			this.selected.target = target;
			this.selected.group = group;
		},
		draw: function() {
			this.svg = d3.select(this.$refs.svg);
			this.model.states.forEach(this.drawState);
		},
		move: function(element, x, y) {
			element.attr("transform", "translate(" + Math.round(x) + "," + Math.round(y) + ")");
		},
		autosize: function() {
			// make sure its big enough to accomodate
			this.svg.attr("width", this.maxWidth)
				.attr("height", this.maxHeight);	
		},
		autosizeState: function(state) {
			var maxWidth = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.x + action.styling.width);
			}, 0);
			var maxHeight = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.y + action.styling.height);
			}, 0);
			state.styling.width = Math.max(state.styling.width, maxWidth);
			state.styling.height = Math.max(state.styling.height, maxHeight);
			
			// make sure the svg itself is big enough
			this.autosize();
			// resize visually
			d3.select(this.$refs.svg.getElementById(state.id + "-rect"))
				.attr("width", state.styling.width)
				.attr("height", state.styling.height)
				
			d3.select(this.$refs.svg.getElementById(state.id + "-resizer"))
				.attr("x", state.styling.width - this.draggableOffset)
				.attr("y", state.styling.height - this.draggableOffset)
		},
		// make sure the target you are dragging is also the one you are moving!
		// otherwise you can get stutters
		draggable: function(target, handler) {
			var self = this;
			// dragging
			target.call(d3.drag()
				.on("start", function(event) {
					console.log("started drag");
				})
				.on("drag", function(event) {
					handler(target, event);
					event.sourceEvent.stopPropagation();
				})
				.on("end", function(event) {
					console.log("dropped", target);
				}));
		},
		// colorize a group of items
		colorize: function(group, color) {
			var result = this.colors.filter(function(x) {
				return x.name == color;
			})[0];
			if (!result) {
				result = this.colors[0];
			}
			// need plain html element
			if (group.node) {
				group = group.node();
			}
			group.querySelectorAll(":scope > text").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.text);
			});
			group.querySelectorAll(":scope > rect").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.background + "; stroke: " + result.border);
			});
			group.querySelectorAll(":scope > rect.resizer").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.border + "; stroke: " + result.text);
			});
		},
		inBounds: function(newX, newY, newWidth, newHeight, boundsX, boundsY, boundsWidth, boundsHeight) {
			console.log("check bounds", newX, newY, newWidth, newHeight, boundsWidth, boundsHeight);
			// the easiest check
			if (newX < boundsX || newY < boundsY) {
				return false;
			}
			else if (newX + newWidth > boundsWidth) {
				return false;
			}
			else if (newY + newHeight > boundsHeight) {
				return false;
			}
			return true;
		},
		drawState: function(state) {
			var self = this;
			
			var group = this.svg.append("g")
				.attr("id", state.id);
			this.move(group, state.styling.x, state.styling.y);
				
			var rect = group.append("rect")
				.attr("width", state.styling.width)
				.attr("height", state.styling.height)
				.attr("class", "process-state-rect")
				.attr("style", state.styling.css)
				.attr("id", state.id + "-rect")
				
			rect.on("click", function() {
				self.select("state", state, group);
			})
				
			var name = group.append("text")
				.text(state.name)
				.attr("class", "process-state-name");
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 10, 20);
			this.autosize();
				
			// dragging
			self.draggable(group, function(target, event) {
				// absolute positioning introduces jumps
				//state.styling.x = event.x;
				//state.styling.y = event.y;
				state.styling.x += event.dx;
				state.styling.y += event.dy;
				self.autosize();
				self.move(group, state.styling.x, state.styling.y);
			});
		
			state.actions.forEach(this.drawAction);
			
			// a resizing rectangle at the bottom right
			var resizer = group.append("rect")
				.attr("width", this.draggableOffset)
				.attr("height", this.draggableOffset)
				.attr("id", state.id + "-resizer")
				.attr("class", "process-state-resizer resizer")
				.attr("x", state.styling.width - this.draggableOffset)
				.attr("y", state.styling.height - this.draggableOffset)
			
			self.draggable(resizer, function(target, event) {
				state.styling.width += event.dx;
				state.styling.height += event.dy;
				self.autosizeState(state);
			});
			
			this.colorize(group, state.styling.color);
		},
		drawAction: function(state, action) {
			var self = this;
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
			this.move(group, 50, 50);
			
			var rect = group.append("rect")
				.attr("width", action.styling.width)
				.attr("height", action.styling.height)
				.attr("class", "process-action-rect")
				.attr("style", action.styling.css)
				.attr("id", action.id + "-rect")
			
			rect.on("click", function() {
				self.select("action", action, group);
			})
				
			var name = group.append("text")
				.text(action.name)
				.attr("class", "process-action-name");
				
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 10, 20);
			this.autosizeState(state);
			
			// dragging
			// to the right and bottom you make the state larger
			// to the left and top you can't go past the state boundaries
			self.draggable(group, function(target, event) {
				var moved = false;
				if (action.styling.x + event.dx >= 0) {
					action.styling.x += event.dx;
					moved = true;
				}
				if (action.styling.y + event.dy >= 0) {
					action.styling.y += event.dy;
					moved = true;
				}
				if (moved) {
					self.autosizeState(state);
					self.move(group, action.styling.x, action.styling.y);	
				}
			});
			
			this.colorize(group, action.styling.color);
		},
		addTemporary: function() {
			this.addAction(this.model.states[0]);
		},
		addAction: function(state, parentAction) {
			// get the max y, move below that
			var furthest = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.y + action.styling.height);
			}, 0);
			var action = {
				name: "Unnamed",
				styling: {
					color: "orange",
					x: 10,
					y: 50 + furthest,
					width: 150,
					height: 100
				},
				id: crypto.randomUUID().replace(/-/g, "")
			};
			state.actions.push(action);	
			this.drawAction(state, action);
		},
		addState: function() {
			// get the max x (+ width) so far, move to the side of that
			var furthest = this.model.states.reduce(function(current, state) {
				return Math.max(current, state.styling.x + state.styling.width);
			}, 0);
			var state = {
				name: this.model.states.length == 0 ? "Initial" : "Unnamed",
				initial: this.model.states.length == 0,
				styling: {
					color: "blue",
					x: this.maxWidth + 15,
					y: 0,
					width: 200,
					height: 200
				},
				id: crypto.randomUUID().replace(/-/g, ""),
				actions: []
			};
			this.model.states.push(state);
			this.drawState(state);
		}
	}
})