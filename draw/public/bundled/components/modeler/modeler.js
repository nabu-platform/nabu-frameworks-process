if (!nabu) { var nabu = {}};
if (!nabu.process) { nabu.process = {}};
nabu.process.provide = function(spec, implementation) {
	if (!nabu.process.state) {
		nabu.process.state = { providers: [] }
	}
	if (!nabu.process.state.providers[spec]) {
		nabu.process.state.providers[spec] = [];
	}
	nabu.process.state.providers[spec].push(implementation);
}
nabu.process.providers = function(spec) {
	return nabu.process.state && nabu.process.state.providers[spec] ? nabu.process.state.providers[spec] : [];
}

Vue.view("process-modeler-component", {
	data: function() {
		return {
			model: null,
			svg: null,
			selected: {
				type: null,
				target: null,
				deselector: null
			},
			copied: {
				type: null,
				target: null
			},
			linking: {
				action: null,
				state: null,
				targetAction: null
			},
			theme: "basic",
			themes: [{
				name: "basic",
				state: "basic",
				service: "blue",
				any: "black",
				all: "black",
				finalizer: "black",
				connector: "blue",
				condition: "black"
			}, {
				name: "black",
				state: "black",
				service: "black",
				any: "black",
				all: "black",
				finalizer: "black",
				connector: "black",
				condition: "black"
			}],
			colors: [{
				name: "blue",
				border: "#8EA7E9",
				background: "#e8edfb",	// #E5E0FF // #d2dcf6
				text: "#7286D3"
			}, {
				name: "orange",
				border: "#FF9F9F",
				background: "#FCDDB0", // FFFAD7
				text: "#E97777"
			}, {
				name: "basic",
				border: "#8EA7E9",
				background: "#fafafa",
				text: "#7286D3"
			}, {
				name: "purple",
				border: "#C3B1E1",
				background: "#e1d8f0",
				text: "#6b43ae"
			}, {
				name: "black",
				border: "black",
				background: "white",
				text: "black"
			}],
			// the offset of the draggable rectangle to resize
			draggableOffset: 2,
			editing: true,
			snapToGrid: true,
			gridSize: 10,
			//connectorColor: "#8EA7E9",
			// make sure its a multiple of gridsize!
			actionHeight: 30,
			// the size of the mapper triangle
			triangleSize: 10,
			subscriptions: [],
			processes: [],
			saving: false,
			// keep track of the last state you interacted with, this for more logical generation
			lastInteractedStateId: null
		}	
	},
	created: function() {
		this.loadProcesses();
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
	beforeDestroy: function() {
		this.subscriptions.forEach(function(x) { x() });
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
		},
		connectorColor: function() {
			var color = this.getColor(this.getThemeColor("connector"));
			return color.border;
		}
	},
	methods: {
		gridify: function(value) {
			var min = value - value % this.gridSize;
			var max = value + (this.gridSize - value % this.gridSize);
			if (max - value > value - min) {
				return min;
			}
			else {
				return max;
			}
		},
		loadProcesses: function() {
			var self = this;
			this.$services.swagger.execute("nabu.frameworks.process.crud.processDefinition.services.list", {editable:true}).then(function(available) {
				self.processes.splice(0);
				if (available.results) {
					nabu.utils.arrays.merge(self.processes, available.results);
				}
			});
		},
		loadProcess: function(processId) {
			var self = this;
			this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.get", { processId: processId }).then(function(result) {
				if (result) {
					result.styling = result.style ? JSON.parse(result.style) : {};
					if (!result.actionRelations) {
						result.actionRelations = [];
					}
					else {
						result.actionRelations.forEach(function(relation) {
							relation.styling = relation.style ? JSON.parse(relation.style) : {}
						});
					}
					// initialize some variables
					if (!result.states) {
						result.states = [];
					}
					result.states.forEach(function(state) {
						if (!state.actions) {
							state.actions = [];
						}
						state.styling = state.style ? JSON.parse(state.style) : {};
						state.actions.forEach(function(action) {
							action.styling = action.style ? JSON.parse(action.style) : {};	
						})
					});
					Vue.set(self, "model", result);
					Vue.nextTick(self.draw);
				}
			});
		},
		save: function() {
			var self = this;
			if (this.model && !this.saving) {
				this.saving = true;
				this.model.style = JSON.stringify(this.model.styling);
				// serialize styling information!
				this.model.states.forEach(function(state) {
					state.style = JSON.stringify(state.styling);
					state.actions.forEach(function(action) {
						action.style = JSON.stringify(action.styling);
					});
				});
				this.model.actionRelations.forEach(function(relation) {
					relation.style = JSON.stringify(relation.styling);
				})
				this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.update", { processId: this.model.id, body: this.model }).then(function() {
					self.$services.notifier.push({message: "Saved process " + self.model.name});
					self.saving = false;
				}, function(error) {
					self.$services.notifier.push({message: "Failed to save process " + self.model.name, color: "danger"});
					self.saving = false;
				});
			}
		},
		startNewModel: function() {
			var model = {
				id: this.newId(),
				name: "New process",
				version: 1,
				created: new Date(),
				queue: null,
				description: null,
				states: [],
				actionRelations: [],
				styling: null
			};
			// for the first version, these are in sync
			model.processId = model.id;
			Vue.set(this, "model", model);
			// need to first render the svg element before we can start drawing
			Vue.nextTick(this.draw);
		},
		deselect: function() {
			var element = this.selected.target ? this.$refs.svg.getElementById(this.selected.target.id) : null;
			if (element) {
				element.classList.remove("selected");
			}
			if (this.selected.deselector) {
				this.selected.deselector();
			}
			this.selected.type = null;
			this.selected.target = null;
			this.selected.deselector = null;
		},
		select: function(type, target, deselector) {
			this.deselect();
			
			// visually deselect the previous entry
			if (this.selected.deselector) {
				this.selected.deselector();
			}
			this.selected.type = type;
			this.selected.target = target;
			this.selected.deselector = deselector;
			
			element = this.$refs.svg.getElementById(target.id);
			if (element) {
				element.classList.add("selected");
			}
			if (type == "state") {
				this.lastInteractedStateId = target.id;
			}
			else if (type == "action") {
				this.lastInteractedStateId = target.processStateId;
			}
			else if (type == "actionRelation") {
				var action = this.getAction(target.actionId);
				this.lastInteractedStateId = action.processStateId;
			}
		},
		draw: function() {
			// clear any content
			while (this.$refs.svg.firstChild) {
				this.$refs.svg.removeChild(this.$refs.svg.firstChild);
			}
			this.svg = d3.select(this.$refs.svg);

			// need to draw all the states before we draw the actions, we might have links			
			this.model.states.forEach(this.drawState);
			this.model.states.forEach(this.drawActions);
			this.model.actionRelations.forEach(this.drawActionRelation);
			
			var self = this;
			var keyHandler = function(event) {
				// check that event originates is not aimed at something else
				if (event.target == document.body) {
					//console.log("key event", event);
					// delete
					if (event.keyCode == 46) {
						self.deleteCurrent();
						event.stopPropagation();
						event.preventDefault();
					}
					else if (event.key == "s" && (event.ctrlKey || event.metaKey) && self.model) {
						self.save();
						event.stopPropagation();
						event.preventDefault();
					}
					else if (event.key == "c" && (event.ctrlKey || event.metaKey) && self.model) {
						nabu.utils.objects.merge(self.copied, self.selected);
					}
					else if (event.key == "v" && (event.ctrlKey || event.metaKey) && self.copied) {
						console.log("pasting", self.copied, self.selected);
						// copying an action to a state
						if (self.copied.type == "action" && self.selected.type == "state") {
							var cloned = JSON.parse(JSON.stringify(self.copied.target));
							cloned.id = self.newId();
							cloned.processStateId = self.selected.target.id;
							self.selected.target.actions.push(cloned);
							cloned.styling.x = 20;
							cloned.styling.y = 50;
							cloned.resultStateId = null;
							self.autosizeState(self.selected.target);
							self.drawAction(cloned);
						}
					}
				}
			}
			var mouseHandler = function(event) {
				var target = event.target;
				self.deselect();
			}
			document.body.addEventListener("keydown", keyHandler);
			// not on the whole document, cause then menu presses deselect!
			//document.body.addEventListener("mousedown", mouseHandler);
			this.$refs.svg.addEventListener("mousedown", mouseHandler);
			this.subscriptions.push(function() {
				document.body.removeEventListener("keydown", keyHandler);	
				//document.body.removeEventListener("mousedown", mouseHandler);
				this.$refs.svg.removeEventListener("mousedown", mouseHandler);	
			})
		},
		move: function(element, x, y) {
			element.attr("transform", "translate(" + Math.round(x) + "," + Math.round(y) + ")");
		},
		autosize: function() {
			// make sure its big enough to accomodate, we add some padding for stuff like borders
			this.svg.attr("width", this.maxWidth + 10)
				.attr("height", this.maxHeight + 10);	
		},
		autosizeState: function(state) {
			var maxWidth = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.x + action.styling.width);
			}, 0);
			var maxHeight = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.y + action.styling.height);
			}, 0);
			state.styling.width = Math.max(state.styling.width, maxWidth + (this.gridSize * 4));
			state.styling.height = Math.max(state.styling.height, maxHeight + (this.gridSize * 4));
			
			// make sure the svg itself is big enough
			this.autosize();
			// resize visually
			d3.select(this.$refs.svg.getElementById(state.id + "-rect"))
				.attr("width", state.styling.width)
				.attr("height", state.styling.height)
				
			d3.select(this.$refs.svg.getElementById(state.id + "-resizer"))
				.attr("cx", state.styling.width - this.draggableOffset)
				.attr("cy", state.styling.height - this.draggableOffset)
		},
		// make sure the target you are dragging is also the one you are moving!
		// otherwise you can get stutters
		draggable: function(target, handler, start, stop) {
			var self = this;
			// keep track of suppressed movement because of grid snapping
			var dx = 0, dy = 0;
			target.call(d3.drag()
				.on("start", function(event) {
					if (start) {
						start(target, event);
					}
				})
				.on("drag", function(event) {
					if (self.snapToGrid) {
						dx += event.dx;
						dy += event.dy;
						// need to be more forceful in overwriting...
						Object.defineProperty(event, "dx", {value:dx - (dx % self.gridSize)})
						Object.defineProperty(event, "dy", {value:dy - (dy % self.gridSize)})
						//event.dx = dx - (dx % self.gridSize);
						//event.dy = dy - (dy % self.gridSize);
						dx -= event.dx;
						dy -= event.dy;
					}
					handler(target, event);
					event.sourceEvent.stopPropagation();
				})
				.on("end", function(event) {
					if (stop) {
						stop(target, event);
					}
				}));
		},
		getColor: function(name) {
			var result = this.colors.filter(function(x) {
				return x.name == name;
			})[0];
			if (!result) {
				result = this.colors[0];
			}
			return result;
		},
		// colorize a group of items
		defaultColorize: function(group, color) {
			var result = this.getColor(color);
			// need plain html element
			if (group.node) {
				group = group.node();
			}
			group.querySelectorAll(":scope > text").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.text);
			});
			group.querySelectorAll(":scope > .background").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.background + "; stroke: " + result.border);
			});
			group.querySelectorAll(":scope > .background-dark").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.border + "; stroke: " + result.text);
			});
			group.querySelectorAll(":scope > .resizer").forEach(function(element) {
				//element.setAttribute("style", "fill: " + result.background + "; stroke: " + result.border);
				element.setAttribute("style", "fill: " + result.background + "; stroke: " + result.border);
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
				.attr("id", state.id)
				.attr("class", "process-state")
				
			this.move(group, state.styling.x, state.styling.y);
				
			var rect = group.append("rect")
				.attr("width", state.styling.width)
				.attr("height", state.styling.height)
				.attr("class", "process-state-rect background")
				.attr("style", state.styling.css)
				.attr("id", state.id + "-rect")
				
			rect.on("click", function(even) {
				self.select("state", state, function() {
					// do nothing
				});
			});
			
			var name = group.append("text")
				.text(state.name)
				.attr("class", "process-state-name");
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 10, 20);
			this.autosize();
				
			rect.on("dblclick", function() {
				console.log("double!");
				name.attr("contenteditable", true);
			})
			
			// dragging
			self.draggable(group, function(target, event) {
				// absolute positioning introduces jumps
				//state.styling.x = event.x;
				//state.styling.y = event.y;
				state.styling.x += event.dx;
				state.styling.y += event.dy;
				self.redrawImpactedRelations(state);
				self.autosize();
				self.move(group, state.styling.x, state.styling.y);
			});
		
			// a resizing rectangle at the bottom right
			var resizer = group.append("circle")
				.attr("id", state.id + "-resizer")
				.attr("class", "process-state-resizer resizer")
				.attr("r", this.draggableOffset * 2)
				.attr("cx", state.styling.width - this.draggableOffset)
				.attr("cy", state.styling.height - this.draggableOffset)
			
			self.draggable(resizer, function(target, event) {
				state.styling.width += event.dx;
				state.styling.height += event.dy;
				self.autosizeState(state);
				self.redrawImpactedRelations(state);
			});
			
			// d3 does not use html dragging
			group.node().addEventListener("mouseover", function(event) {
				if (self.linking.action && self.linking.action.processStateId != state.id) {
					rect.node().classList.add("drop-highlight");
					self.linking.state = state;
				}
				event.stopPropagation();
			})
			group.node().addEventListener("mouseleave", function(event) {
				rect.node().classList.remove("drop-highlight");
				if (self.linking.state == state) {
					self.linking.state = null;
				}
				event.stopPropagation();
			})
			
			// add some default colors
			this.defaultColorize(group, this.getThemeColor("state", state.styling.color));
		},
		getThemeColor: function(type, override) {
			if (override) {
				return override;
			}
			var self = this;
			var current = this.themes.filter(function(theme) {
				return theme.name == self.model.styling.theme;
			})[0];
			return current && current[type] ? current[type] : "basic";
		},
		hasRelation: function(action, targetAction) {
			return this.model.actionRelations.filter(function(x) {
				return x.actionId == action.id
					&& x.targetActionId == targetAction.id;
			}).length > 0;
		},
		drawActions: function(state) {
			var self = this;
			state.actions.forEach(function(action) {
				self.drawAction(action)
			});
		},
		drawText: function(group, text, x, y, width, clazz, size) {
			var current = group.node().querySelector("." + clazz);
			var wrapper = null;
			if (current) {
				// clear it, but maintain wrapper, it might have styling etc
				while (current.firstChild) {
					current.removeChild(current.firstChild);
				}
				//d3.select(current).remove();
				wrapper = d3.select(current);
			}
			if (wrapper == null) {
				wrapper = group.append("text")
			}
			wrapper.attr("class", clazz)
				.attr("font-size", size)
			
			// move to correct place
			this.move(wrapper, x, y);
			
			var fontSize = 8;
			// we assume every letter is 
			if (size == "smaller") {
				fontSize = 7;
			}
			var amountOfCharacters = Math.floor(width / fontSize);
			var parts = [];
			while (text.length > amountOfCharacters) {
				var part = text.substring(0, Math.min(text.length, amountOfCharacters));
				var space = part.lastIndexOf(" ");
				if (space >= 0) {
					parts.push(text.substring(0, space));
					text = text.substring(space + 1);
				}
				// hard break unfortunately
				else {
					parts.push(part);
					text = text.substring(part.length);
				}
			}
			// push remainder
			parts.push(text);
			parts.forEach(function(x, i) {
				var summary = wrapper.append("tspan")
					.text(x)
					.attr("x", 0)
					.attr("y", i + "em");
			});
		},
		// we automatically resize the action as you type longer names
		updatedActionName: function(action) {
			if (action.actionType == "service") {
				// is bold now, so no longer 8
				action.styling.width = Math.max(action.styling.width, !action.name ? 0 : action.name.length * 10);
			}
			this.draw();
		},
		updatedActionSummary: function(action) {
			// the 40 is the offset that the summary starts at
			if (action.summary) {
				var amountOfLines = (action.summary.length * 7.5) / action.styling.width;
				// we want at least space for SOME summary
				action.styling.height = Math.max(action.styling.height, 40 + 14 + amountOfLines * 14);
				// make sure we don't increment per px
				action.styling.height -= action.styling.height % 14;
			}
			else {
				action.styling.height = this.actionHeight;
			}
			this.draw();
		},
		drawActionName: function(action) {
			var actionGroup = d3.select(this.$refs.svg.getElementById(action.id));
			// the name is not split over multiple lines, use the summary for that!
			var name = actionGroup.append("text")
				.text(action.name ? action.name : "Unnamed")
				.attr("class", "process-action-name");
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, action.automatic ? 20 : 10, 20);

//			this.drawText(actionGroup, action.name, 10, 20, action.styling.width, "process-action-name");
		},
		drawActionSummary: function(action) {
			if (action.summary) {
				var actionGroup = d3.select(this.$refs.svg.getElementById(action.id));
				this.drawText(actionGroup, action.summary, action.automatic ? 20 : 10, 40, action.styling.width, "process-action-summary", "smaller");
			}
		},
		drawAction: function(action) {
			if (action.actionType == null || action.actionType == "service") {
				this.drawServiceAction(this.getState(action.processStateId), action);
			}
			else if (action.actionType == "finalizer") {
				this.drawFinalizerAction(action);
			}
			else if (action.actionType == "any" || action.actionType == "all") {
				this.drawAnyAction(action);
			}
		},
		
		
		
		getState: function(id) {
			return this.model.states.filter(function(x) {
				return x.id == id;
			})[0];	
		},
		getAction: function(id) {
			var result = null;
			this.model.states.forEach(function(state) {
				state.actions.forEach(function(action) {
					if (action.id == id) {
						result = action;
					}
				})
			});
			return result;
		},
		getClosestAttachment: function(fromX, fromY, toX, toY, toWidth, toHeight) {
			var points = [
				// center left	
				{
					x: toX,
					y: toY + (toHeight / 2),
					side: "left"
				},
				// center top
				{
					x: toX + (toWidth / 2),
					y: toY,
					side: "top"
				},
				// center right
				{
					x: toX + toWidth,
					y: toY + (toHeight / 2),
					side: "right"
				},
				// center bottom
				{
					x: toX + (toWidth / 2),
					y: toY + toHeight,
					side: "bottom"
				}
			];
			// we explicitly do not allow snapping to the right side of an action as this is the "starting" point and might be confusing
			points.splice(2, 1);
			
			var currentDistance = null;
			return points.reduce(function(current, point) {
				var distance = Math.sqrt(Math.pow(point.x - fromX, 2) + Math.pow(point.y - fromY, 2));
				if (current == null || distance < currentDistance) {
					currentDistance = distance;
					return point;
				}
				return current;
			}, null);
		},
		redrawImpactedRelations: function(target) {
			// if it's an action, we want to redraw those
			if (target.processStateId) {
				this.model.actionRelations.filter(function(x) {
					return x.actionId == target.id || x.targetActionId == target.id;
				}).forEach(this.drawActionRelation);
				if (target.resultStateId) {
					this.drawActionResultState(target);
				}
			}
			
			// if it's a state, we want to redraw state actions
			else if (target.actions) {
				var self = this;
				// all actions with this state as target
				this.model.states.forEach(function(state) {
					state.actions.forEach(function(action) {
						if (action.resultStateId == target.id) {
							self.drawActionResultState(action);
						}
					})
				});
				// all actions in this state with another state as target
				target.actions.forEach(function(action) {
					if (action.resultStateId) {
						self.drawActionResultState(action);
					}
				})
			}
		},
		drawActionResultState: function(action) {
			var self = this;
			
			// there can be only one
			var id = action.id + "-result-state";
			
			// check if there is a previous line, we might be redrawing
			var existing = this.svg.node().getElementById(id);
			if (existing) {
				d3.select(existing).remove();
			}
			// same for hitbox
			existing = this.svg.node().getElementById(id + "-hitbox");
			if (existing) {
				d3.select(existing).remove();
			}
			
			// only proceed with drawing if we actually have a state id
			if (action.resultStateId) {
				var state = this.getState(action.resultStateId);
				
				// get the group for each action
				var actionGroup = this.svg.node().getElementById(action.id);
				var stateGroup = this.svg.node().getElementById(action.resultStateId);
				var parentGroup = this.svg.node().getElementById(action.processStateId);
	
				var rootBounds = this.$refs.svg.getBoundingClientRect();
				var parentBounds = parentGroup.getBoundingClientRect();
				var stateBounds = stateGroup.getBoundingClientRect();
				
				// relativize to root of svg
				parentBounds.x -= rootBounds.x;
				parentBounds.y -= rootBounds.y;
				stateBounds.x -= rootBounds.x;
				stateBounds.y -= rootBounds.y;
				
				// we always start from the center right, we add 5 because that's the radius of the connection circle
				var fromX = parentBounds.x + action.styling.x + action.styling.width + this.triangleSize;
				var fromY = parentBounds.y + action.styling.y + (action.styling.height / 2);
				
				// the end is more dynamic depending on where the target action is in relation to the source
				var to = this.getClosestAttachment(fromX, fromY, stateBounds.x, stateBounds.y, state.styling.width, state.styling.height);
				
				var generator = d3.line()
					.x(function(p) { return p.x })
					.y(function(p) { return p.y })
					.curve(d3.curveLinear);
					
				var points = [{
					x: fromX,
					y: fromY
				}, {
					x: fromX + ((to.x - fromX) / 2),
					y: fromY
				}, {
					x: fromX + ((to.x - fromX) / 2),
					y: to.y
				}, {
					x: to.x,
					y: to.y
				}];
				
				// the want to change the middle two points in case we have a vertical snap point
				if (to.side == "top" || to.side == "bottom") {
					points[1].x = fromX;
					points[1].y = fromY + ((to.y - fromY) / 2);
					points[2].x = to.x;
					points[2].y = fromY + ((to.y - fromY) / 2);
				}
				
				var path = this.svg.append("path")
					.attr("id", id)
					.attr("fill", "none")
					.attr("stroke", this.connectorColor)
					.attr("stroke-width", 2)
					.attr("d", generator(points))
					
				path.on("click", function() {
					path.node().style.strokeWidth = 4;
					self.select("actionRelation", relation, function() {
						path.node().style.strokeWidth = 2;	
					});
				})
				
				// draw a secondary invisible path purely for click purposes
				var hitbox = this.svg.append("path")
					.attr("id", id + "-hitbox")
					.attr("stroke-width", 15)
					.attr("fill", "none")
					.attr("stroke", "transparent")
					.attr("d", generator(points))
					
				hitbox.on("click", function() {
					path.node().style.strokeWidth = 4;
					self.select("actionResult", action, function() {
						path.node().style.strokeWidth = 2;	
					});
				});
				
				path.raise();
				hitbox.raise();
			}
		},
		// can only be drawn if the actions are already drawn!
		drawActionRelation: function(relation) {
			var self = this;
			
			// check if there is a previous line, we might be redrawing
			var existing = this.svg.node().getElementById(relation.id);
			if (existing) {
				d3.select(existing).remove();
			}
			existing = this.svg.node().getElementById(relation.id + "-hitbox");
			if (existing) {
				d3.select(existing).remove();
			}
			existing = this.svg.node().getElementById(relation.id + "-condition");
			if (existing) {
				d3.select(existing).remove();
			}
			existing = this.svg.node().getElementById(relation.id + "-condition-text");
			if (existing) {
				d3.select(existing).remove();
			}
			
			
			var action = this.getAction(relation.actionId);
			var targetAction = this.getAction(relation.targetActionId);
			
			// get the group for each action
			var actionGroup = this.svg.node().getElementById(action.id);
			var targetActionGroup = this.svg.node().getElementById(targetAction.id);
			
			// we draw lines in the state group using relative coordinates to that
			var stateGroup = this.svg.node().getElementById(action.processStateId);
			
			// we always start from the center right, we add 5 because that's the radius of the connection circle
			var fromX = action.styling.x + action.styling.width + this.triangleSize;
			var fromY = action.styling.y + (action.styling.height / 2);
			
			// the end is more dynamic depending on where the target action is in relation to the source
			
			var to = this.getClosestAttachment(fromX, fromY, targetAction.styling.x, targetAction.styling.y, targetAction.styling.width, targetAction.styling.height);
			
			var generator = d3.line()
				.x(function(p) { return p.x })
				.y(function(p) { return p.y })
				.curve(d3.curveLinear);
				
			var points = [{
				x: fromX,
				y: fromY
			}, {
				x: fromX + ((to.x - fromX) / 2),
				y: fromY
			}, {
				x: fromX + ((to.x - fromX) / 2),
				y: to.y
			}, {
				x: to.x,
				y: to.y
			}];
			
			// the want to change the middle two points in case we have a vertical snap point
			if (to.side == "top" || to.side == "bottom") {
				points[1].x = fromX;
				points[1].y = fromY + ((to.y - fromY) / 2);
				points[2].x = to.x;
				points[2].y = fromY + ((to.y - fromY) / 2);
			}
			
			var path = d3.select(stateGroup).append("path")
				.attr("class", "relation type-" + relation.relationType)
				.attr("id", relation.id)
				.attr("fill", "none")
				.attr("stroke", this.connectorColor)
				.attr("stroke-width", 2)
				.attr("d", generator(points))
				
			path.on("click", function() {
				path.node().style.strokeWidth = 4;
				self.select("actionRelation", relation, function() {
					path.node().style.strokeWidth = 2;	
				});
			})
			
			// draw a secondary invisible path purely for click purposes
			var hitbox = d3.select(stateGroup).append("path")
				.attr("id", relation.id + "-hitbox")
				.attr("stroke-width", 15)
				.attr("fill", "none")
				.attr("stroke", "transparent")
				.attr("d", generator(points))
				
			hitbox.on("click", function() {
				path.node().style.strokeWidth = 4;
				self.select("actionRelation", relation, function() {
					path.node().style.strokeWidth = 2;	
				});
			});
			
			if (relation.condition) {
				// calculate the mid point of the middle line part
				// this is the least likely to conflict with other lines visually
				if (to.side == "top" || to.side == "bottom") {
					var y = points[2].y;
					var xFactor = Math.abs(points[2].x - points[1].x) / 2;
					var x = Math.max(points[2].x, points[1].x) - xFactor;
				}
				else {
					var x = points[2].x;
					var yFactor = Math.abs(points[2].y - points[1].y) / 2;
					var y = Math.max(points[2].y, points[1].y) - yFactor;
				}
				var color = this.getColor(this.getThemeColor("condition"));
				var condition = d3.select(stateGroup).append("rect")
					.attr("id", relation.id + "-condition")
					.attr("x", x - 5)
					.attr("y", y - 5)
					.attr("fill", color.border)
					.attr("stroke", color.border)
					.attr("width", 10)
					.attr("height", 10)
					
				var conditionText = d3.select(stateGroup).append("text")
					.attr("id", relation.id + "-condition-text")
					.text(relation.condition)
					.attr("font-size", "x-small")
					.attr("x", x + 10)
					.attr("y", y + 3)
					.attr("fill", color.text)
					
				// if we don't want to show the condition permanently, hide it until hover over rectangle
				if (!relation.styling.showCondition) {
					conditionText.node().style.display = "none";
					condition.node().addEventListener("mouseenter", function() {
						conditionText.node().style.display = "block";
					});
					condition.node().addEventListener("mouseleave", function() {
						conditionText.node().style.display = "none";
					});
				}
					
			}
		},
		drawActionConnecting: function(actionFrom, event) {
			var group = d3.select(this.$refs.svg.getElementById(actionFrom.id));
			
			// bring the action to the front so we can see the line always
			//group.raise();
			
			// same for the state if you want to link to another state
			//d3.select(this.$refs.svg.getElementById(actionFrom.processStateId)).raise();
			
			var generator = d3.line()
				.x(function(p) { return p.x })
				.y(function(p) { return p.y })
				.curve(d3.curveLinear);
				
			var path = group.append("path")
				.attr("fill", "none")
				.attr("stroke", this.connectorColor)

			var actions = {
				update: function(event) {
					var points = [{
						x: actionFrom.styling.width,
						y: actionFrom.styling.height / 2
					}, 
					// the halfway point
					{
						x: event.x - ((event.x - actionFrom.styling.width) / 2),	
						y: actionFrom.styling.height / 2
					}, 
					{
						x: event.x - ((event.x - actionFrom.styling.width) / 2),	
						y: event.y - 1
					},
					// move ever so slightly out of the way to prevent false mouseenter/leave hits
					{
						x: event.x - 1,
						y: event.y -1
					}]
					path.attr("d", generator(points))
				},
				remove: function() {
					path.remove();
				}
			}
			actions.update(event);
			return actions;
		},
		newId: function() {
			return crypto.randomUUID().replace(/-/g, "");
		},
		deleteCurrent: function() {
			var self = this;
			if (this.selected.type == "state" && this.selected.target) {
				var index = this.model.states.indexOf(this.selected.target);
				if (index >= 0) {
					this.model.states.splice(index, 1);
				}
				// update any actions that might lead to this state
				this.model.states.forEach(function(state) {
					state.actions.forEach(function(action) {
						if (action.resultStateId == self.selected.target.id) {
							action.resultStateId = null;
						}
					})
				})
			}
			else if (this.selected.type == "action" && this.selected.target) {
				var state = this.getState(this.selected.target.processStateId);
				var index = state.actions.indexOf(this.selected.target);
				if (index >= 0) {
					state.actions.splice(index, 1);
				}
				// remove any relations with this action
				this.model.actionRelations.filter(function(x) {
					return x.actionId == self.selected.target.id || x.targetActionId == self.selected.target.id;
				}).forEach(function(remove) {
					self.model.actionRelations.splice(self.model.actionRelations.indexOf(remove), 1);
				});
			}
			else if (this.selected.type == "actionResult" && this.selected.target) {
				this.selected.target.resultStateId = null;
			}
			else if (this.selected.type == "actionRelation" && this.selected.target) {
				var index = this.model.actionRelations.indexOf(this.selected.target);
				console.log("deleting", this.selected.target, index);
				if (index >= 0) {
					this.model.actionRelations.splice(index, 1);
				}
			}
			this.selected.type = null;
			this.selected.target = null;
			this.selected.deselector = null;
			// redraw the whole thing!
			this.draw();
		},
		addActionToCurrent: function(type, name, width, height) {
			var state = null;
			if (this.lastInteractedStateId) {
				state = this.getState(this.lastInteractedStateId);
			}
			if (state == null) {
				state = this.model.states[this.model.states.length - 1];
			}
			var currentAction = null;
			if (this.selected.type == "action") {
				currentAction = this.selected.target;
			}
			this.addAction(type, name, width, height, state, currentAction);
		},
		addAction: function(type, name, width, height, state, parentAction) {
			// get the max y, move below that
			var furthest = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.y + action.styling.height);
			}, 0);
			
			var action = {
				name: name,
				actionType: type,
				styling: {
					color: null,
					x: (parentAction ? parentAction.styling.x + parentAction.styling.width + 50 : this.gridSize * 2) + (this.gridSize * 2),
					// if we position at the top, keep some space
					y: parentAction ? parentAction.styling.y : Math.max(this.actionHeight * 2, furthest + this.actionHeight),
					width: width,
					height: height,
					minOccurs: 1,
					maxOccurs: 1
				},
				processStateId: state.id,
				id: this.newId()
			};
			state.actions.push(action);	
			this.drawAction(action);
			
			// if we had selected an action, select this new one!
			if (this.selected.type == "action") {
				this.select("action", action);
			}
		},
		addState: function() {
			// get the max x (+ width) so far, move to the side of that
			var furthest = this.model.states.reduce(function(current, state) {
				return Math.max(current, state.styling.x + state.styling.width);
			}, 0);
			var state = {
				processDefinitionId: this.model.id,
				name: this.model.states.length == 0 ? "Initial" : "Unnamed",
				initial: this.model.states.length == 0,
				styling: {
					color: "basic",
					x: furthest + (this.gridSize * 4),
					y: this.gridSize * 2,
					width: this.gridSize * 24,
					height: this.gridSize * 20
				},
				id: this.newId(),
				actions: []
			};
			this.model.states.push(state);
			this.drawState(state);
			this.select("state", state);
		},
		
		
		// ---------------------------------- SERVICE ACTION IMPLEMENTATION
		
		autosizeAction: function(action, state) {
			d3.select(this.$refs.svg.getElementById(action.id + "-rect"))
				.attr("width", action.styling.width)
				.attr("height", action.styling.height)
				
			d3.select(this.$refs.svg.getElementById(action.id + "-resizer"))
				.attr("cx", action.styling.width - this.draggableOffset)
				.attr("cy", action.styling.height - this.draggableOffset)
				
			this.drawActionMapper(action);
			this.drawActionAutomatic(action);
			// redraw summary
			this.drawActionSummary(action);
			this.drawActionReference(action);
			this.drawActionTimeout(action);
			/*
			d3.select(this.$refs.svg.getElementById(action.id + "-mapper"))
				.attr("cx", action.styling.width)
				.attr("cy", action.styling.height / 2)
			*/
			// on resizing, we might impact lines
			this.redrawImpactedRelations(action);
			if (state) {
				this.autosizeState(state);
			}
			
			this.colorizeDefaultAction(action);
		},
		drawServiceAction: function(state, action) {
			var self = this;
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
				.attr("class", "process-action " + (action.minOccurs == 0 ? "optional" : ""))
				
			this.move(group, action.styling.x, action.styling.y);
			
			var rect = group.append("rect")
				.attr("width", action.styling.width)
				.attr("height", action.styling.height)
				.attr("class", "process-action-rect background")
				.attr("style", action.styling.css)
				.attr("id", action.id + "-rect")
				
			// d3 does not use html dragging
			group.node().addEventListener("mouseover", function(event) {
				// if we are not dragging _this_ action, we highlight for a link
				// note that we have to be in the same state for this to happen
				if (self.linking.action && self.linking.action.id != action.id && self.linking.action.processStateId == state.id && !self.hasRelation(self.linking.action, action)) {
					rect.node().classList.add("drop-highlight");
					self.linking.targetAction = action;
				}
				event.stopPropagation();
			})
			group.node().addEventListener("mouseleave", function(event) {
				rect.node().classList.remove("drop-highlight");
				if (self.linking.targetAction == action) {
					self.linking.targetAction = null;
				}
				event.stopPropagation();
			})

			rect.on("click", function() {
				self.select("action", action, function() {
					// do nothing
				});
			})
			
			this.drawActionName(action);
			this.drawActionSummary(action);
				
			/*
			var name = group.append("text")
				.text(action.name ? action.name : "Unnamed")
				.attr("class", "process-action-name");
				
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 10, 20);
			
			if (action.summary) {
				var totalSummary = group.append("text");
				action.summary.split(/[\n]+/).forEach(function(part, index) {
					var summary = totalSummary.append("tspan")
						.text(part)
						.attr("font-size", "smaller")
						.attr("class", "process-action-summary")

				})
				self.move(totalSummary, 10, 40);		
			}
			*/
			
			this.autosizeState(state);
			
			// dragging
			// to the right and bottom you make the state larger
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
					self.redrawImpactedRelations(action);
				}
			});
			
			// a resizing rectangle at the bottom right
			var resizer = group.append("circle")
				.attr("id", action.id + "-resizer")
				.attr("class", "process-action-resizer resizer")
				.attr("r", this.draggableOffset * 2)
				.attr("cx", action.styling.width - this.draggableOffset)
				.attr("cy", action.styling.height - this.draggableOffset)
			
			self.draggable(resizer, function(target, event) {
				action.styling.width += event.dx;
				action.styling.height += event.dy;
				self.autosizeAction(action, state);
			});
			
			/*
			// a resizing rectangle at the bottom right
			var mapper = group.append("circle")
				.attr("r", 5)
				.attr("id", action.id + "-mapper")
				.attr("class", "process-action-mapper mapper")
				.attr("cx", action.styling.width)
				.attr("cy", action.styling.height / 2)
			*/	
			
			this.drawActionMapper(action);
			this.drawActionResultState(action);
			this.drawActionReference(action);
			this.drawActionTimeout(action);
			this.drawActionAutomatic(action);
			this.colorizeDefaultAction(action);
		},
		colorizeDefaultAction(action) {
			var color = this.getColor(this.getThemeColor(action.actionType, action.styling.color));
			var group = this.$refs.svg.getElementById(action.id);
			this.defaultColorize(group, this.getThemeColor(action.actionType, action.styling.color));
			group.querySelectorAll(":scope > .mapper").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.border + "; stroke: " + color.border);
			});
			group.querySelectorAll(":scope > .automatic").forEach(function(element) {
				element.setAttribute("style", "fill: white; stroke: " + color.border);
			});
			// a reference box
			group.querySelectorAll(":scope > .reference > rect").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.text + "; stroke: " + color.border);
			})
			group.querySelectorAll(":scope > .reference > text").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.background);
			})
			// a timeout box
			group.querySelectorAll(":scope > .timeout > rect").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.text + "; stroke: " + color.border);
			})
			group.querySelectorAll(":scope > .timeout > text").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.background);
			})	
		},
		drawActionAutomatic: function(action) {
			var existing = this.svg.node().getElementById(action.id + "-automatic");
			if (existing) {
				d3.select(existing).remove();
			}
			if (action.automatic) {
				var triangleSize = this.triangleSize;
				var group = d3.select(this.svg.node().getElementById(action.id));
				var trianglePath = d3.path();
				trianglePath.moveTo(0, (action.styling.height / 2) - triangleSize);
				trianglePath.lineTo(triangleSize, action.styling.height / 2);
				trianglePath.lineTo(0, (action.styling.height / 2) + triangleSize);
				trianglePath.closePath();
				
				var mapper = group.append("path")
					.attr("d", trianglePath)
					.attr("id", action.id + "-automatic")
					.attr("class", "automatic")
			}
		},
		drawActionReference: function(action) {
			var group = d3.select(this.svg.node().getElementById(action.id));
			
			var reference = null;
			var existing = this.svg.node().getElementById(action.id + "-reference");
			if (existing) {
				reference = d3.select(existing);
			}
			
			if (action.reference) {
				// new, draw it all
				if (reference == null) {
					reference = group.append("g")
						.attr("class", "reference")
						.attr("id", action.id + "-reference")
					reference.append("rect")
						// 4 px padding on each side
						.attr("width", 8 + (action.reference.length * 8))
						.attr("height", 14)
						.attr("x", 0)
						.attr("y", 0)
					var referenceText = reference.append("text")
						.text(action.reference)
						.attr("font-size", "13px")
					this.move(referenceText, 4, 11);
				}
				// just move it
				this.move(reference, 0, action.styling.height);
			}
			else if (reference) {
				d3.select(reference).remove();
			}
		},
		drawActionTimeout: function(action) {
			var group = d3.select(this.svg.node().getElementById(action.id));
			
			var reference = null;
			var existing = this.svg.node().getElementById(action.id + "-timeout");
			if (existing) {
				reference = d3.select(existing);
			}
			if (action.automatic && (action.delay || action.schedule)) {
				if (reference == null) {
					reference = group.append("g")
						.attr("class", "timeout")
						.attr("id", action.id + "-timeout")
					var text = action.delay ? action.delay : action.schedule;
					reference.append("rect")
						// 4 px padding on each side
						.attr("width", 8 + (text.length * 8))
						.attr("height", 14)
						.attr("x", 0)
						.attr("y", 0)
					var referenceText = reference.append("text")
						.text(text)
						.attr("font-size", "13px")
					this.move(referenceText, 4, 11);
				}
				this.move(reference, 0, -14);
			}
			else if (reference) {
				d3.select(reference).remove();
			}
		},
		drawActionMapper: function(action) {
			var self = this;
			var group = d3.select(this.svg.node().getElementById(action.id));
			var existing = this.svg.node().getElementById(action.id + "-mapper");
			if (existing) {
				d3.select(existing).remove();
			}
			existing = this.svg.node().getElementById(action.id + "-stopper");
			if (existing) {
				d3.select(existing).remove();
			}
			// don't draw a mapper if it is a finalizer service!
			if (!action.finalizer) {
				var triangleSize = this.triangleSize;
				var trianglePath = d3.path();
				trianglePath.moveTo(action.styling.width, (action.styling.height / 2) - triangleSize);
				trianglePath.lineTo(action.styling.width + triangleSize, action.styling.height / 2);
				trianglePath.lineTo(action.styling.width, (action.styling.height / 2) + triangleSize);
				trianglePath.closePath();
					
				var mapper = group.append("path")
					.attr("d", trianglePath)
					.attr("id", action.id + "-mapper")
					.attr("class", "mapper")
					
				var state = this.getState(action.processStateId);
				var line = null;
				self.draggable(mapper, function(target, event) {
					line.update(event);
				}, function(target, event) {
					// on start, create the line
					line = self.drawActionConnecting(action, event);
					self.linking.action = action;
					self.linking.state = state;
				}, function(target, event) {
					// only within own state!
					if (self.linking.targetAction && self.linking.targetAction.id != action.id && self.linking.targetAction.processStateId == action.processStateId) {
						var relation = {
							id: self.newId(),
							actionId: action.id,
							targetActionId: self.linking.targetAction.id,
							relationType: "flow"
						};
						self.model.actionRelations.push(relation);
						self.drawActionRelation(relation);
					}
					else if (self.linking.state && self.linking.state.id != action.processStateId) {
						action.resultStateId = self.linking.state.id;
						self.drawActionResultState(action);
					}
					self.linking.action = null;
					self.linking.state = null;
					self.linking.targetAction = null;
					
					// make sure we don't have drop highlights anymore
					self.svg.node().querySelectorAll(".drop-highlight").forEach(function(element) {
						element.classList.remove("drop-highlight");
					});
					line.remove();
				});
				this.colorizeDefaultAction(action);
				return mapper;
			}
			// for finalizers, we draw a rectangle to indicate it stops there
			// DEPRECATED: finalizing services are replaced with dedicated finalizer actions
			else {
				group.append("rect")
					.attr("fill", "black")
					.attr("width", this.triangleSize)
					.attr("height", this.triangleSize)
					.attr("x", action.styling.width)
					.attr("y", (action.styling.height / 2) - this.triangleSize / 2)
					.attr("id", action.id + "-stopper")
			}
		},
		
		// ---------------------------------------- FINALIZER implementation
		drawFinalizerAction: function(action) {
			var self = this;
			var state = this.getState(action.processStateId);
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
				.attr("class", "process-finalizer")
				
			this.move(group, action.styling.x, action.styling.y);
			
			var circle = group.append("circle")
				.attr("r", action.styling.width / 2)
				.attr("class", "background finalizer")
				.attr("fill", "black")
				.attr("id", action.id + "-figure")
				.attr("cx", action.styling.width / 2)
				.attr("cy",  action.styling.height / 2)
				
			// have a secondary circle inside
			var circle2 = group.append("circle")
				.attr("r", action.styling.width / 5)
				.attr("class", "background-dark finalizer")
				.attr("fill", "black")
				.attr("id", action.id + "-figure2")
				.attr("cx", action.styling.width / 2)
				.attr("cy",  action.styling.height / 2)

			// draw name
			// the name is not split over multiple lines, use the summary for that!
			var name = group.append("text")
				.text(action.name ? action.name : "Unnamed")
				//.attr("fill", "black")
				.attr("font-size", "smaller")
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 0, -10);
				
			this.defaultColorize(group, this.getThemeColor(action.actionType, action.styling.color));
				
			// d3 does not use html dragging
			group.node().addEventListener("mouseover", function(event) {
				// if we are not dragging _this_ action, we highlight for a link
				// note that we have to be in the same state for this to happen
				if (self.linking.action && self.linking.action.id != action.id && self.linking.action.processStateId == state.id && !self.hasRelation(self.linking.action, action)) {
					circle.node().classList.add("drop-highlight");
					self.linking.targetAction = action;
				}
				event.stopPropagation();
			});
			
			group.node().addEventListener("mouseleave", function(event) {
				circle.node().classList.remove("drop-highlight");
				if (self.linking.targetAction == action) {
					self.linking.targetAction = null;
				}
				event.stopPropagation();
			})

			circle.on("click", function() {
				self.select("action", action, function() {
					// do nothing
				});
			})
			
			this.autosizeState(state);
			
			// dragging
			// to the right and bottom you make the state larger
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
					self.redrawImpactedRelations(action);
				}
			});
		},
		
		drawAnyAction: function(action) {
			var self = this;
			var state = this.getState(action.processStateId);
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
				.attr("class", "process-" + action.actionType)
				
			this.move(group, action.styling.x, action.styling.y);

			var rect = group.append("rect")
				.attr("width", action.styling.width)
				.attr("height", action.styling.height)
				.attr("class", "background selectable " + action.actionType)
				.attr("id", action.id + "-rect")
				// the counter translation is because we can't set a correct transform-origin (??) so instead we move it a bit because it rotates top left
				// never mind...
				//.attr("transform", "translate(15px, -6px) rotate(45deg)")
				
			// draw name
			// the name is not split over multiple lines, use the summary for that!
			if (action.name) {
				var name = group.append("text")
					.text(action.name ? action.name : "Unnamed")
					//.attr("fill", "black")
					.attr("font-size", "smaller")
				// not sure why we need 20 in y-direction but not questioning it now...
				this.move(name, 0, -10);
			}
				
			
			var name = group.append("text")
				.text(action.actionType.toUpperCase())
				.attr("font-size", "x-small")
				
			this.move(name, 5, 18);
				
			this.defaultColorize(group, this.getThemeColor(action.actionType, action.styling.color));
				
			// d3 does not use html dragging
			group.node().addEventListener("mouseover", function(event) {
				// if we are not dragging _this_ action, we highlight for a link
				// note that we have to be in the same state for this to happen
				if (self.linking.action && self.linking.action.id != action.id && self.linking.action.processStateId == state.id && !self.hasRelation(self.linking.action, action)) {
					rect.node().classList.add("drop-highlight");
					self.linking.targetAction = action;
				}
				event.stopPropagation();
			});
			
			group.node().addEventListener("mouseleave", function(event) {
				rect.node().classList.remove("drop-highlight");
				if (self.linking.targetAction == action) {
					self.linking.targetAction = null;
				}
				event.stopPropagation();
			})

			rect.on("click", function() {
				self.select("action", action, function() {
					// do nothing
				});
			})
			
			this.drawActionMapper(action);
			this.autosizeState(state);
			
			// dragging
			// to the right and bottom you make the state larger
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
					self.redrawImpactedRelations(action);
				}
			});
		}
	}
})