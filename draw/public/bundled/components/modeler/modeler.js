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

// if a version has been released, we store it in memory for reuse
nabu.process.versions = {};

Vue.view("process-modeler-component", {
	props: {
		serviceContext: {
			type: String,
			required: false
		},
		processVersionId: {
			type: String,
			required: false
		},
		// you can pass in an instance, we will use it to visualize the steps that have been run
		processInstanceId: {
			type: String,
			required: false
		}
	},
	data: function() {
		return {
			// check if we can edit it (we can't edit released versions)
			editable: false,
			model: null,
			svg: null,
			// "mouse" or "trackpad"
			mouseMode: "mouse",
			root: null,
			stateRelations: null,
			allowMultiselect: true,
			multiselect: [],
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
			icons: ["signal", "service"],
			themes: [{
				name: "basic",
				state: "basic",
				service: "blue",
				serviceAutomatic: "orange",
				event: "yellow",
				signal: "green",
				human: "pink",
				any: "black",
				all: "black",
				finalizer: "black",
				initializer: "black",
				connector: "blue",
				condition: "black"
			}, {
				name: "black",
				state: "black",
				service: "black",
				event: "black",
				signal: "black",
				human: "black",
				any: "black",
				all: "black",
				finalizer: "black",
				initializer: "black",
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
				border: "#CC6600",
				background: "#FFE6CC", // FFFAD7
				text: "#994C00"
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
			}, {
				name: "yellow",
				border: "#CCCC00",
				background: "#FFFFCC",
				text: "#999900"
			}, {
				name: "green",
				border: "#7cb987",
				background: "#d7e9da",
				text: "#3d7348"
			}, {
				name: "red",
				border: "#CC0000",
				background: "#FFCCCC",
				text: "#990000"
			}, {
				name: "pink",
				border: "#CC0066",
				background: "#fce5f1",
				text: "#CC0066"
			}],
			// the offset of the draggable rectangle to resize
			draggableOffset: 2,
			editing: true,
			snapToGrid: true,
			// grid size has to be even, otherwise dividing by 2 (to position the lines) might end in unmatching start/end stuff
			gridSize: 6,
			//connectorColor: "#8EA7E9",
			// make sure its a multiple of gridsize!
			actionHeight: 30,
			// the size of the mapper triangle
			triangleSize: 10,
			subscriptions: [],
			processes: [],
			saving: false,
			// keep track of the last state you interacted with, this for more logical generation
			lastInteractedStateId: null,
			debounceTimer: null,
			lastServiceInputs: [],
			lastService: null,
			lastTypeId: null,
			lastTypeFields: [],
			instance: null,
			// a list of all instantiated items for quick lookup of highlighting
			instantiated: []
		}	
	},
	created: function() {
		console.log("Created modeler", this.processVersionId);
		var previousMouseMode = localStorage.getItem("process-modeler:mouseMode");
		if (["mouse", "trackpad"].indexOf(previousMouseMode) >= 0) {
			this.mouseMode = previousMouseMode;
		}
		//this.loadProcesses();
		if (this.processVersionId) {
			this.loadProcess(this.processVersionId);
		}
		else if (this.processInstanceId) {
			this.loadProcessInstance(this.processInstanceId);
		}
		else {
			this.startNewModel();
		}
	},
	watch: {
		mouseMode: function(newValue) {
			localStorage.setItem("process-modeler:mouseMode", newValue);
		},
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
		},
		hasServiceLister: function() {
			return this.$services.swagger.operations["nabu.web.core.manage.reflection.service.list"] != null;
		}
	},
	methods: {
		listAnonymizationServices: function(value) {
			return this.$services.swagger.execute("nabu.web.core.manage.reflection.service.list", {
				interfaceId: "nabu.frameworks.process.specs.process.anonymize",
				q: value
			});
		},
		getCapturedValueNames: function(value) {
			var result = [];
			var available = ["$correlationId", "$deviceId", "$userId", "$sessionId"];
			nabu.utils.arrays.merge(available, this.model.captures.filter(function(x) { return !!x.name }).map(function(x) {
				return x.name;
			}));
			console.log("merged is", available);
			available.forEach(function(x) {
				console.log("checking", x, value);
				if (result.indexOf(x) < 0 && (!value || x.toLowerCase().indexOf(value.toLowerCase()) >= 0)) {
					result.push(x);
				}
			})
			return result;
		},
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
		updatePhase: function(capture, value) {
			// a service has multiple phases (input and output)
			if (this.selected.target.actionType == "service") {
				var phase = this.getCapturePhase(value); 
				if (phase) {
					capture.phase = phase;
				}
			}
			// non-services only have the data phase which means it is available at the start (so input)
			else {
				capture.phase = "input";
			}
		},
		getCapturePhase: function(capture) {
			// if we have a query, we need to check whether it is possible during input
			if (capture.indexOf("=") == 0) {
				// in most cases we straight capture a value from the input or output, make it easy then
				if (capture.indexOf("=input/") == 0) {
					return "input";
				}
				else if (capture.indexOf("=output/") == 0) {
					return "output";
				}
				// if it is not quite as clear, we let the user decide
				// note that "in theory" any plain variable access that is not from input or output, comes straight from the pipeline so is also during output phase
				// but we might call services and do calculations on that which is hard to determine
				// can finetune this in the future
				else {
					return null;
				}
			}
			// fixed values don't matter when they are captured, might as well do it during input phase
			else {
				return "input";
			}
		},
		debounce: function(runnable) {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
				this.debounceTimer = null;
			}
			this.debounceTimer = setTimeout(runnable, 50);
		},
		loadProcesses: function() {
			var self = this;
			this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.list", {enabled:true, "$serviceContext": this.serviceContext}).then(function(available) {
				self.processes.splice(0);
				if (available.definitions) {
					nabu.utils.arrays.merge(self.processes, available.definitions);
				}
			});
		},
		loadProcessInstance: function(processInstanceId) {
			var self = this;
			this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.instance.get", { instanceId: processInstanceId, "$serviceContext": this.serviceContext }).then(function(result) {
				if (result) {
					// make sure we load the correct definition
					self.loadProcess(result.processVersionId);
					// store instance so we can highlight stuff
					self.instance = result;
					
					if (result.actionInstances) {
						result.actionInstances.forEach(function(x) {
							self.instantiated.push(x.processActionId);
						});
					}
					if (result.actionRelationInstances) {
						result.actionRelationInstances.forEach(function(x) {
							self.instantiated.push(x.processActionRelationId);
						});
					}
					if (result.stateInstances) {
						result.stateInstances.forEach(function(x) {
							self.instantiated.push(x.processStateId);
						});
					}
				}
			});
		},
		loadProcess: function(processVersionId) {
			var self = this;
			if (nabu.process.versions[processVersionId]) {
				var model = nabu.process.versions[processVersionId];
				Vue.set(self, "model", model);
				Vue.nextTick(self.draw);
				return model;
			}
			this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.version.get", { processVersionId: processVersionId, "$serviceContext": this.serviceContext }).then(function(result) {
				if (result) {
					self.editable = result.released == null;
					result.styling = result.style ? JSON.parse(result.style) : {};
					if (!result.actionRelations) {
						result.actionRelations = [];
					}
					else {
						result.actionRelations.forEach(function(relation) {
							relation.styling = relation.style ? JSON.parse(relation.style) : {}
						});
					}
					if (!result.stateRelations) {
						result.stateRelations = [];
					}
					else {
						result.stateRelations.forEach(function(relation) {
							relation.styling = relation.style ? JSON.parse(relation.style) : {}
						});
					}
					if (!result.captures) {
						result.captures = [];
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
							action.json = action.configuration ? JSON.parse(action.configuration) : {};
							action.binding = action.dataBinding ? JSON.parse(action.dataBinding) : [];
						})
					});
					if (result.released != null) {
						nabu.process.versions[processVersionId] = result;
					}
					Vue.set(self, "model", result);
					Vue.nextTick(self.draw);
				}
			});
		},
		save: function() {
			var self = this;
			if (this.model && !this.saving) {
				this.saving = true;
				this.model.modified = new Date();
				this.model.style = JSON.stringify(this.model.styling);
				// serialize styling information!
				this.model.states.forEach(function(state) {
					state.style = JSON.stringify(state.styling);
					state.actions.forEach(function(action) {
						action.style = JSON.stringify(action.styling);
						action.configuration = JSON.stringify(action.json);
						action.dataBinding = JSON.stringify(action.binding);
					});
				});
				this.model.actionRelations.forEach(function(relation) {
					relation.style = JSON.stringify(relation.styling);
				});
				this.model.stateRelations.forEach(function(relation) {
					relation.style = JSON.stringify(relation.styling);
				});
				var svg = document.createElement("div");
				// make a clone
				svg.innerHTML = this.$refs.svg.outerHTML;
				svg.querySelectorAll(".hitbox").forEach(function(element) {
					element.parentNode.removeChild(element);
				});
				svg.querySelector(".root").removeAttribute("transform");
				this.model.svg = svg.innerHTML;
				
				this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.version.update", { processVersionId: this.model.id, body: this.model, "$serviceContext": this.serviceContext }).then(function() {
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
				name: "My process",
				version: 1,
				created: new Date(),
				queue: null,
				description: null,
				states: [],
				actionRelations: [],
				stateRelations: [],
				captures: [],
				styling: {},
				defaultIdentificationType: "custom"
			};
			// for the first version, these are in sync
			model.processDefinitionId = model.id;
			model.modified = new Date();
			Vue.set(this, "model", model);
			// need to first render the svg element before we can start drawing
			Vue.nextTick(this.draw);
			this.editable = true;
		},
		addInputMapping: function(action) {
			action.binding.push({
				key: null,
				value: null
			});
		},
		getServiceInputs: function(action, value) {
			if (action.serviceId == this.lastService) {
				return this.lastServiceInputs.filter(function(x) {
					return !value || x.name.toLowerCase().indexOf(value.toLowerCase()) >= 0;
				});
			}
			else {
				var self = this;
				var promise = this.$services.q.defer();
				self.lastServiceInputs.splice(0);
				this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.service.definition", {serviceId: action.serviceId, "$serviceContext": this.serviceContext}).then(function(result) {
					self.lastServiceInputs.splice(0);
					if (result && result.inputs) {
						nabu.utils.arrays.merge(self.lastServiceInputs, result.inputs);
					}
					promise.resolve(self.lastServiceInputs);
				}, promise);
				return promise;
			}
		},
		getTypeDefinition: function(action, value) {
			if (action.dataTypeId == this.lastTypeId) {
				return this.lastTypeFields.filter(function(x) {
					return !value || x.name.toLowerCase().indexOf(value.toLowerCase()) >= 0;
				});
			}
			else if (action.dataTypeId) {
				var self = this;
				var promise = this.$services.q.defer();
				self.lastTypeFields.splice(0);
				this.$services.swagger.execute("nabu.frameworks.process.manage.rest.process.type.definition", {typeId: action.dataTypeId, "$serviceContext": this.serviceContext}).then(function(result) {
					self.lastTypeFields.splice(0);
					if (result && result.fields) {
						nabu.utils.arrays.merge(self.lastTypeFields, result.fields);
					}
					promise.resolve(self.lastTypeFields);
				}, promise);
				return promise;
			}
		},
		getCapturesFor: function(actionId) {
			return this.model.captures.filter(function(x) {
				return x.processActionId == actionId;
			});
		},
		removeCapture: function(capture) {
			var index = this.model.captures.indexOf(capture);	
			if (index >= 0) {
				this.model.captures.splice(index, 1);
			}
		},
		newCapture: function(actionId, capture) {
			var capture = {
				id: this.newId(),
				processActionId: actionId,
				capture: capture
			};
			capture.globalReferenceId = capture.id;
			this.model.captures.push(capture);
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
			
			var transform = this.root ? this.root.attr("transform") : null;
			
			var self = this;
			// clear any content except defs
			this.$refs.svg.querySelectorAll(":scope > :not(defs)").forEach(function(child) {
				child.parentNode.removeChild(child);
			});
			this.svg = d3.select(this.$refs.svg);
			
			this.multiselectDrag();
			
			this.root = this.svg.append("g")
				.attr("class", "root");
				
			if (transform) {
				this.root.attr("transform", transform);
			}
				
			this.stateRelations = this.root.append("g")
				.attr("class", "state-relations");
			
			// add zoomability + dragging to move around!
			var handleZoom = function(event) {
				self.root.attr('transform', event.transform);
			};
			// https://devdocs.io/d3~7/d3-zoom#zoom
			// without the filter, you get the default filter which pans (moving the map) with the left mouse button
			// to enable panning while also supporting drag drop to place stuff and selection etc, we want to move this to the middle button
			var zoom = d3.zoom().on('zoom', handleZoom)
				// the default filter:
				// return (!event.ctrlKey || event.type === 'wheel') && !event.button;
				.filter(function(event) {
					if (self.mouseMode == "trackpad") {
						return (event.ctrlKey && event.type === 'wheel') || event.button == 1;
					}
					else {
						// 1 == middle button
						return (!event.ctrlKey && event.button == 1) || event.type === "wheel";
					}
				})
				// the default scale is Infinity
				.scaleExtent([0.2, 3])
			this.svg.call(zoom);
			this.$el.addEventListener("wheel", function(event) {
				if (self.mouseMode != "trackpad" || event.ctrlKey) {
					event.preventDefault();
					event.stopPropagation();
				}
			})

			// need to draw all the states before we draw the actions, we might have links			
			this.model.states.forEach(this.drawState);
			this.model.states.forEach(this.drawActions);
			this.model.actionRelations.forEach(this.drawActionRelation);
			this.model.stateRelations.forEach(this.drawStateRelation);
			var keyHandler = function(event) {
				// check that event originates is not aimed at something else
				if (event.target == document.body) {
					//console.log("key event", event);
					// delete
					if (event.keyCode == 46) {
						self.debounce(self.deleteCurrent);
						event.stopPropagation();
						event.preventDefault();
					}
					else if (event.key == "s" && (event.ctrlKey || event.metaKey) && self.model) {
						self.save();
						event.stopPropagation();
						event.preventDefault();
					}
					else if (event.key == "c" && (event.ctrlKey || event.metaKey) && self.model) {
						// reset the copied so we don't accidently update stuff by reference (?)
						Vue.set(self, "copied", {
							type: null,
							target: null
						});
						nabu.utils.objects.merge(self.copied, self.selected);
					}
					else if (event.key == "v" && (event.ctrlKey || event.metaKey) && self.copied) {
						// copying an action to a state
						if (self.copied.type == "action" && self.selected.type == "state") {
							var cloned = JSON.parse(JSON.stringify(self.copied.target));
							cloned.id = self.newId();
							cloned.globalReferenceId = cloned.id;
							cloned.processStateId = self.selected.target.id;
							self.selected.target.actions.push(cloned);
							cloned.styling.x = 20;
							cloned.styling.y = 50;
							cloned.resultStateId = null;
							// duplicate the captures as well
							self.model.captures.filter(function(x) {
								return x.processActionId == self.copied.target.id;
							}).forEach(function(capture) {
								var clonedCapture = JSON.parse(JSON.stringify(capture));	
								clonedCapture.id = self.newId();
								clonedCapture.globalReferenceId = clonedCapture.id;
								clonedCapture.processActionId = cloned.id;
								self.model.captures.push(clonedCapture);
							});
							self.autosizeState(self.selected.target);
							self.drawAction(cloned);
							event.stopPropagation();
							event.preventDefault();
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
				self.$refs.svg.removeEventListener("mousedown", mouseHandler);
			})
		},
		move: function(element, x, y) {
			element.attr("transform", "translate(" + Math.round(x) + "," + Math.round(y) + ")");
		},

		multiselectDrag: function() {
			var rect = null;
			var self = this;
			var dragStart = function(event) {
				if (self.allowMultiselect) {
					rect = self.root.append("rect")
						.attr("x", event.x)
						.attr("y", event.y)
						.attr("width", 0)
						.attr("height", 0)
						.attr("style", "fill: steelblue; opacity: 0.2");
				}
			}
			
			var dragMove = function(event) {
				if (self.allowMultiselect) {
					rect.attr("width", event.x - rect.attr("x"));
					rect.attr("height", event.y - rect.attr("y"));
				}
			}
			
			var dragEnd = function(event) {
				if (self.allowMultiselect) {
					rect.remove();
					rect = null;
				}
			}
			
			var dragBehavior = d3.drag()
			    .on("drag", dragMove)
			    .on("start", dragStart)
			    .on("end", dragEnd);
			
			this.svg.call(dragBehavior);	
		},
		
		autosize: function() {
			var factor = 1;
			if (this.root.attr("transform")) {
				var index = this.root.attr("transform").indexOf("scale(");
				if (index >= 0) {
					var scale = this.root.attr("transform").substring(index).replace(/scale\((.*?)\).*/, "$1");
					console.log("extracted scale", scale);
					factor = parseFloat(scale);
				}
			}
			// make sure its big enough to accomodate, we add some padding for stuff like borders
			this.svg.attr("width", (this.maxWidth + 10))
				.attr("height", (this.maxHeight + 10));	
		},
		moveStateContent: function(state, dx, dy) {
			var self = this;
			// move actions in opposite way to remain at the same place
			state.actions.forEach(function(action) {
				self.moveAction(action, -dx, -dy);
				self.redrawImpactedRelations(action);
			});
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
		resizable: function(target, handler, start, stop) {
			this.draggable(target, handler, start, stop, true);
		},
		// make sure the target you are dragging is also the one you are moving!
		// otherwise you can get stutters
		draggable: function(target, handler, start, stop, isResize) {
			if (!this.editable) {
				return false;
			}
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
						// when resizing, we take steps that are twice the grid size
						// this makes sure that when we move (in single gridsize increments), we can always find a layout where the line is "straight"
						// need to be more forceful in overwriting...
						Object.defineProperty(event, "dx", {value:dx - (dx % (self.gridSize * (isResize ? 2 : 1)))})
						Object.defineProperty(event, "dy", {value:dy - (dy % (self.gridSize * (isResize ? 2 : 1)))})
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
			group.querySelectorAll(":scope > .icon").forEach(function(element) {
				element.setAttribute("style", "fill: " + result.border + "; stroke:" + result.border);
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
			
			var group = this.root.append("g")
				.attr("id", state.id)
				.attr("class", "process-state")
				
			this.addUsed(state.id, group);
				
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
			
			self.resizable(resizer, function(target, event) {
				state.styling.width += event.dx;
				state.styling.height += event.dy;
				self.autosizeState(state);
				self.redrawImpactedRelations(state);
			});
			
			var resizer2 = group.append("circle")
				.attr("id", state.id + "-resizer2")
				.attr("class", "process-state-resizer resizer")
				.attr("r", this.draggableOffset * 2)
				.attr("cx", 0)
				.attr("cy", 0);
				
			self.resizable(resizer2, function(target, event) {
				state.styling.width -= event.dx;
				state.styling.height -= event.dy;
				state.styling.x += event.dx;
				state.styling.y += event.dy;
				self.move(group, state.styling.x, state.styling.y);
				self.autosizeState(state);
				self.moveStateContent(state, event.dx, event.dy);
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
		getThemeColor: function(type, override, automatic) {
			if (override) {
				return override;
			}
			var self = this;
			var currentTheme = self.model.styling.theme;
			if (!currentTheme) {
				currentTheme = "basic";
			}
			var current = this.themes.filter(function(theme) {
				return theme.name == currentTheme;
			})[0];
			if (automatic && current && current[type + "Automatic"]) {
				return current[type + "Automatic"];
			}
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
				action.styling.width = Math.max(action.styling.width, (!action.name ? 0 : action.name.length * 10) + (action.styling.icon ? 10 : 0));
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
		drawActionIcon: function(action) {
			if (action.styling.icon) {
				var actionGroup = d3.select(this.$refs.svg.getElementById(action.id));
				var icon = actionGroup.append("use")
					.attr("class", "icon")
					.attr("x", action.automatic ? 20 : 10)
					.attr("y", 6)
					.attr("width", 20)
					.attr("height", 16)
					.attr("href", "#icon-" + action.styling.icon)
			}	
		},
		drawActionName: function(action) {
			var actionGroup = d3.select(this.$refs.svg.getElementById(action.id));
			// the name is not split over multiple lines, use the summary for that!
			var name = actionGroup.append("text")
				.text(action.name ? action.name : "Unnamed")
				.attr("class", "process-action-name");
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, (action.automatic ? 20 : 10) + (action.styling.icon ? 26 : 0), 20);

//			this.drawText(actionGroup, action.name, 10, 20, action.styling.width, "process-action-name");
		},
		drawActionSummary: function(action) {
			if (action.summary) {
				var actionGroup = d3.select(this.$refs.svg.getElementById(action.id));
				this.drawText(actionGroup, action.summary, action.automatic ? 20 : 10, 40, action.styling.width, "process-action-summary", "smaller");
			}
		},
		drawAction: function(action) {
			if (action.actionType == null || action.actionType == "service" || action.actionType == "event" || action.actionType == "signal" || action.actionType == "human") {
				this.drawMainAction(this.getState(action.processStateId), action);
			}
			else if (action.actionType == "finalizer") {
				this.drawFinalizerAction(action);
			}
			else if (action.actionType == "initializer") {
				this.drawInitializerAction(action);
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
				
				this.model.stateRelations.filter(function(x) {
					return x.actionId == target.id;
				}).forEach(this.drawStateRelation);
				
				// no longer
				//if (target.resultStateId) {
				//	this.drawActionResultState(target);
				//}
			}
			
			// if it's a state, we want to redraw state actions
			else if (target.actions) {
				var self = this;
				this.model.stateRelations.forEach(function(relation) {
					if (relation.targetStateId == target.id) {
						self.drawStateRelation(relation);
					}
					var action = self.getAction(relation.actionId);
					if (action.processStateId == target.id ){
						self.drawStateRelation(relation);
					}
				});
				// all actions with this state as target
				//this.model.states.forEach(function(state) {
				//	state.actions.forEach(function(action) {
				//		if (action.resultStateId == target.id) {
				//			self.drawActionResultState(action);
				//		}
				//	})
				//});
				// all actions in this state with another state as target
				//target.actions.forEach(function(action) {
				//	if (action.resultStateId) {
				//		self.drawActionResultState(action);
				//	}
				//})
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
				
				var path = this.root.append("path")
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
				var hitbox = this.root.append("path")
					.attr("id", id + "-hitbox")
					.attr("class", "hitbox")
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
				
				hitbox.raise();
				path.raise();
			}
		},
		getScale: function() {
			if (this.root.attr("transform")) {
				var index = this.root.attr("transform").indexOf("scale(");
				if (index >= 0) {
					var scale = this.root.attr("transform").substring(index).replace(/scale\((.*?)\).*/, "$1");
					factor = parseFloat(scale);
					return factor;
				}
			}
			return 1;
		},
		drawStateRelation: function(relation) {
			var self = this;
			
			// check if there is a previous line, we might be redrawing
			var existing = this.svg.node().getElementById(relation.id);
			if (existing) {
				d3.select(existing).remove();
			}
			// same for hitbox
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
			var state = this.getState(relation.targetStateId);
				
			// get the group for each action
			var actionGroup = this.svg.node().getElementById(relation.actionId);
			var stateGroup = this.svg.node().getElementById(relation.targetStateId);
			var parentGroup = this.svg.node().getElementById(action.processStateId);

			var rootBounds = this.$refs.svg.getBoundingClientRect();
			var parentBounds = parentGroup.getBoundingClientRect();
			var stateBounds = stateGroup.getBoundingClientRect();
			
			// relativize to root of svg
			// does not work with scaling/moving!
			parentBounds.x -= rootBounds.x;
			parentBounds.y -= rootBounds.y;
			stateBounds.x -= rootBounds.x;
			stateBounds.y -= rootBounds.y;
			
			// parent is the one containing the action
			parentBounds = this.getState(action.processStateId).styling;
			stateBounds = state.styling;
			
			// we always start from the center right, we add 5 because that's the radius of the connection circle
			var fromX = parentBounds.x + action.styling.x + action.styling.width + this.triangleSize;
			var fromY = parentBounds.y + action.styling.y + (action.styling.height / 2);
			
			var leftOffset = 100;
			if (this.curvature == "linear") {
				// the end is more dynamic depending on where the target action is in relation to the source
				var to = this.getClosestAttachment(fromX, fromY, stateBounds.x, stateBounds.y, state.styling.width, state.styling.height);
				var curvature = d3.curveLinear;
			}
			else {
				var curvature = d3.curveBasis;
				var to = {x: state.styling.x, y: state.styling.y + (state.styling.height / 2)};
				if (to.x < fromX + leftOffset) {
					to.side = "left";
				}
			}
			
			var generator = d3.line()
				.x(function(p) { return p.x })
				.y(function(p) { return p.y })
				.curve(curvature);
				
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
			// if the target action is on the left of the source action, we want to do additional stuff
			else if (to.side == "left") {
				var resultingOffset = Math.max(0, to.x - fromX);
				points[1].x = fromX + (leftOffset - resultingOffset);
				points[1].y = points[0].y;
				points[2].x = to.x - (leftOffset - resultingOffset);
				points[2].y = points[3].y;
			}
			
			var path = this.stateRelations.append("path")
				.attr("class", "relation type-" + relation.relationType)
				.attr("id", relation.id)
				.attr("fill", "none")
				.attr("stroke", this.connectorColor)
				.attr("stroke-width", 2)
				.attr("d", generator(points))
				
			path.on("click", function() {
				path.node().style.strokeWidth = 4;
				self.select("stateRelation", relation, function() {
					path.node().style.strokeWidth = 2;	
				});
			})
			
			// draw a secondary invisible path purely for click purposes
			var hitbox = this.stateRelations.append("path")
				.attr("id", relation.id + "-hitbox")
				.attr("class", "hitbox")
				.attr("stroke-width", 15)
				.attr("fill", "none")
				.attr("stroke", "transparent")
				.attr("d", generator(points))
				
			hitbox.on("click", function() {
				path.node().style.strokeWidth = 4;
				self.select("stateRelation", relation, function() {
					path.node().style.strokeWidth = 2;	
				});
			});
			
			hitbox.raise();
			path.raise();
			this.stateRelations.raise();
			
			if (relation.condition) {
				// calculate the mid point of the middle line part
				// this is the least likely to conflict with other lines visually
				if (to.side == "top" || to.side == "bottom") {
					var y = points[2].y;
					var xFactor = Math.abs(points[2].x - points[1].x) / 2;
					var x = Math.max(points[2].x, points[1].x) - xFactor;
				}
				else if (to.side == "left") {
					var deltaX = (points[2].x - points[1].x);
					var x = points[1].x + (deltaX / 2);
					var yFactor = Math.abs(points[2].y - points[1].y) / 2;
					var y = Math.max(points[2].y, points[1].y) - yFactor;
				}
				else {
					var x = points[2].x;
					var yFactor = Math.abs(points[2].y - points[1].y) / 2;
					var y = Math.max(points[2].y, points[1].y) - yFactor;
				}
				var color = this.getColor(this.getThemeColor("condition"));
				var condition = this.stateRelations.append("rect")
					.attr("id", relation.id + "-condition")
					.attr("x", x - 5)
					.attr("y", y - 5)
					.attr("fill", color.border)
					.attr("stroke", color.border)
					.attr("width", 10)
					.attr("height", 10)
					
				var conditionText = this.stateRelations.append("text")
					.attr("id", relation.id + "-condition-text")
					.text(relation.condition)
					.attr("font-size", "x-small")
					.attr("x", x + 10)
					.attr("y", y + 3)
					.attr("fill", color.text)
					
				// if we don't want to show the condition permanently, hide it until hover over rectangle
				if (!relation.styling || !relation.styling.showCondition) {
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
			
			var leftOffset = 100;
			if (this.curvature == "linear") {
				var to = this.getClosestAttachment(fromX, fromY, targetAction.styling.x, targetAction.styling.y, targetAction.styling.width, targetAction.styling.height);
				var curvature = d3.curveLinear;
			}
			else {
				var curvature = d3.curveBasis;
				var to = {x: targetAction.styling.x, y: targetAction.styling.y + (targetAction.styling.height / 2)};
				if (to.x < fromX + leftOffset) {
					to.side = "left";
				}
			}
			
			
			var generator = d3.line()
				.x(function(p) { return p.x })
				.y(function(p) { return p.y })
				.curve(curvature);
				
			// d3.curveLinear
			// d3.curveCardinal
			// d3.curveCatmullRom
				
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
			// if the target action is on the left of the source action, we want to do additional stuff
			else if (to.side == "left") {
				var resultingOffset = Math.max(0, to.x - fromX);
				points[1].x = fromX + (leftOffset - resultingOffset);
				points[1].y = points[0].y;
				points[2].x = to.x - (leftOffset - resultingOffset);
				points[2].y = points[3].y;
			}
			
			var path = d3.select(stateGroup).append("path")
				.attr("class", "relation type-" + relation.relationType)
				.attr("id", relation.id)
				.attr("fill", "none")
				.attr("stroke", this.connectorColor)
				.attr("stroke-width", 2)
				.attr("d", generator(points))
				
			this.addUsed(relation.id, path);
				
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
				.attr("class", "hitbox")
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
				else if (to.side == "left") {
					var deltaX = (points[2].x - points[1].x);
					var x = points[1].x + (deltaX / 2);
					var yFactor = Math.abs(points[2].y - points[1].y) / 2;
					var y = Math.max(points[2].y, points[1].y) - yFactor;
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
				if (!relation.styling || !relation.styling.showCondition) {
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
				
				var actionIds = this.selected.target.actions.map(function(action) { return action.id });
				
				// remove any state relations involved with this
				this.model.stateRelations.filter(function(x) {
					return x.targetStateId == self.selected.target.id || actionIds.indexOf(x.actionId) >= 0;
				}).forEach(function(remove) {
					self.model.stateRelations.splice(self.model.stateRelations.indexOf(remove), 1);
				});
				
				// remove any relationships linked to actions within this state
				this.model.actionRelations.filter(function(x) {
					return actionIds.indexOf(x.actionId) >= 0 || actionIds.indexOf(x.targetActionId) >= 0;
				}).forEach(function(relationToRemove) {
					self.model.actionRelations.splice(self.model.actionRelations.indexOf(relationToRemove), 1);
				})
				
				// remove any captures from the actions within this state
				this.model.captures.filter(function(x) {
					return actionIds.indexOf(x.processActionId) >= 0;
				}).forEach(function(remove) {
					self.model.captures.splice(self.model.captures.indexOf(remove), 1);
				});
			}
			else if (this.selected.type == "action" && this.selected.target) {
				var state = this.getState(this.selected.target.processStateId);
				var index = state.actions.indexOf(this.selected.target);
				if (index >= 0) {
					state.actions.splice(index, 1);
				}
				// remove any state relations involved with this
				this.model.stateRelations.filter(function(x) {
					return x.actionId == self.selected.target.id;
				}).forEach(function(remove) {
					self.model.stateRelations.splice(self.model.stateRelations.indexOf(remove), 1);
				});
				// remove any relations with this action
				this.model.actionRelations.filter(function(x) {
					return x.actionId == self.selected.target.id || x.targetActionId == self.selected.target.id;
				}).forEach(function(remove) {
					self.model.actionRelations.splice(self.model.actionRelations.indexOf(remove), 1);
				});
				this.model.captures.filter(function(x) {
					return x.processActionId == self.selected.target.id;
				}).forEach(function(remove) {
					self.model.captures.splice(self.model.captures.indexOf(remove), 1);
				});
			}
			else if (this.selected.type == "actionResult" && this.selected.target) {
				this.selected.target.resultStateId = null;
			}
			else if (this.selected.type == "actionRelation" && this.selected.target) {
				var index = this.model.actionRelations.indexOf(this.selected.target);
				if (index >= 0) {
					this.model.actionRelations.splice(index, 1);
				}
			}
			else if (this.selected.type == "stateRelation" && this.selected.target) {
				var index = this.model.stateRelations.indexOf(this.selected.target);
				if (index >= 0) {
					this.model.stateRelations.splice(index, 1);
				}
			}
			this.selected.type = null;
			this.selected.target = null;
			this.selected.deselector = null;
			// redraw the whole thing!
			this.draw();
		},
		addActionToCurrent: function(type, name, width, height, icon) {
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
			this.addAction(type, name, width, height, state, currentAction, icon);
		},
		addAction: function(type, name, width, height, state, parentAction, icon) {
			// get the max y, move below that
			var furthest = state.actions.reduce(function(current, action) {
				return Math.max(current, action.styling.y + action.styling.height);
			}, 0);
			
			var action = {
				name: name,
				actionType: type,
				styling: {
					icon: icon,
					color: null,
					x: (parentAction ? parentAction.styling.x + parentAction.styling.width + 50 : this.gridSize * 2) + (this.gridSize * 2),
					// if we position at the top, keep some space
					y: parentAction ? parentAction.styling.y : Math.max(this.actionHeight * 2, furthest + this.actionHeight),
					width: width,
					height: height,
					minOccurs: 1,
					maxOccurs: 1
				},
				json: {},
				binding: [],
				processStateId: state.id,
				id: this.newId()
			};
			action.globalReferenceId = action.id;
			// by default we want reprocessable
			if (type == "service") {
				action.reprocessable = true;
				// because we now have failure lines, let's set autofail as default
				action.autoFail = true;
			}
			else if (type == "human") {
				// currently we will always automatically create a human task rather than wait for it to occur naturally
				// to indicate this, set this boolean
				action.automatic = true;
				// and always synchronous, no use in waiting for a new task just to create this task
				action.synchronous = true;
			}
			else if (type == "finalizer") {
				action.automatic = true;
				action.synchronous = true;
			}
			else if (type == "any") {
				action.automatic = true;
				action.synchronous = true;
			}
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
				return Math.max(current, state.styling.y + state.styling.height);
			}, 0);
			var state = {
				processVersionId: this.model.id,
				name: this.model.states.length == 0 ? "Initial" : "Unnamed",
				//initial: this.model.states.length == 0,
				styling: {
					color: null,
					x: (this.gridSize * 4),
					y: furthest + (this.gridSize * 2),
					width: this.gridSize * 24,
					height: this.gridSize * 20
				},
				id: this.newId(),
				actions: []
			};
			state.globalReferenceId = state.id;
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
		addUsed: function(id, target) {
			if (this.instantiated.indexOf(id) >= 0) {
				var existing = target.attr("class");
				if (!existing) {
					existing = "";
				}
				target.attr("class", existing + " used");
			}
		},
		moveAction: function(action, dx, dy) {
			action.styling.x += dx;
			action.styling.y += dy;
			var group = d3.select(this.$refs.svg.getElementById(action.id));
			this.move(group, action.styling.x, action.styling.y);
		},
		drawMainAction: function(state, action) {
			var self = this;
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
				.attr("class", "process-action " + (action.lax ? "optional" : ""))

			this.addUsed(action.id, group);
				
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
			
			this.drawActionIcon(action);
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
			
			self.resizable(resizer, function(target, event) {
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
			//this.drawActionResultState(action);
			this.drawActionReference(action);
			this.drawActionTimeout(action);
			this.drawActionAutomatic(action);
			this.colorizeDefaultAction(action);
		},
		colorizeDefaultAction(action) {
			var color = this.getColor(this.getThemeColor(action.actionType, action.styling.color, action.automatic));
			var group = this.$refs.svg.getElementById(action.id);
			this.defaultColorize(group, this.getThemeColor(action.actionType, color ? color.name : action.styling.color));
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
			group.querySelectorAll(":scope > .timeout > .icon").forEach(function(element) {
				element.setAttribute("style", "fill: " + color.border + "; stroke:" + color.border);
			});
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
					.attr("class", "automatic" + (action.synchronous ? " synchronous" : " asynchronous"))
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
			if (action.automatic && (action.delay || action.schedule || action.synchronous)) {
				if (reference == null) {
					reference = group.append("g")
						.attr("class", "timeout")
						.attr("id", action.id + "-timeout")
						
					var showIcon = true;
					if (action.synchronous && showIcon) {
						var icon = reference.append("use")
							.attr("class", "icon")
							.attr("x", 0)
							.attr("y", 0)
							.attr("width", 20)
							.attr("height", 16)
							.attr("href", "#icon-synchronous");
						this.move(icon, 4, -2);
					}
					else {
						var text = action.synchronous ? "Synchronous" : (action.delay ? action.delay : action.schedule);
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
							relationType: event.sourceEvent.ctrlKey ? "flow-stop" :"flow",
							styling: {}
						};
						relation.globalReferenceId = relation.id;
						self.model.actionRelations.push(relation);
						self.drawActionRelation(relation);
					}
					else if (self.linking.state && self.linking.state.id != action.processStateId) {
						var relation = {
							id: self.newId(),
							actionId: action.id,
							targetStateId: self.linking.state.id,
							styling: {}
						};
						relation.globalReferenceId = relation.id;
						self.model.stateRelations.push(relation);
						self.drawStateRelation(relation);
						//action.resultStateId = self.linking.state.id;
						//self.drawActionResultState(action);
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
				.text(action.name ? action.name : "")
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
		
		// ---------------------------------------- INITIALIZER implementation
		drawInitializerAction: function(action) {
			var self = this;
			var state = this.getState(action.processStateId);
			var stateGroup = d3.select(this.$refs.svg.getElementById(state.id));
			var group = stateGroup.append("g")
				.attr("id", action.id)
				.attr("class", "process-finalizer")
				
			this.move(group, action.styling.x, action.styling.y);
			
			// we want visually half a circle and half a rectangle
			// the rectangle part is partly so we can attach the triangle to it
			var rect = group.append("rect")
				.attr("width", action.styling.width / 2)
				.attr("height", action.styling.height)
				.attr("class", "background-dark initializer")
				.attr("fill", "black")
				
			this.move(rect, action.styling.width / 2, 0);
			
			var circle = group.append("circle")
				.attr("r", action.styling.width / 2)
				.attr("class", "background initializer")
				.attr("fill", "black")
				.attr("id", action.id + "-figure")
				.attr("cx", action.styling.width / 2)
				.attr("cy",  action.styling.height / 2)
			
			circle.on("click", function() {
				self.select("action", action, function() {
					// do nothing
				});
			})
			
			// draw name
			// the name is not split over multiple lines, use the summary for that!
			var name = group.append("text")
				.text(action.name ? action.name : "")
				//.attr("fill", "black")
				.attr("font-size", "smaller")
			// not sure why we need 20 in y-direction but not questioning it now...
			this.move(name, 0, -10);
			
			this.defaultColorize(group, this.getThemeColor(action.actionType, action.styling.color));
				
			
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
		},
		
		// need to update the width 
		updateAnyActionOccurs: function(action, value) {
			Vue.set(action, 'maxOccurs', value);
			// this takes into account 3 letters
			var normalWidth = 30;
			// this is the final name shown in the block
			var nameResult = action.maxOccurs == 0 ? 'ALL' : 'ANY' + (action.maxOccurs == null || action.maxOccurs == 1 ? '' : ' ' + action.maxOccurs);
			var overflow = nameResult.length - 3;
			action.styling.width = normalWidth + (overflow * 6);
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
				.attr("class", "background selectable " + (action.maxOccurs == 0 ? 'all' : 'any'))
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
				
			
			var nameResult = action.maxOccurs == 0 ? 'ALL' : 'ANY' + (action.maxOccurs == null || action.maxOccurs == 1 ? '' : ' ' + action.maxOccurs);
			var name = group.append("text")
				.text(nameResult)
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
		},
		exportAsPng: function() {
			// code thanks to https://stackoverflow.com/questions/3975499/convert-svg-to-image-jpeg-png-etc-in-the-browser
			// currently most of the styling seems to make it through except for the coloring of the icons
			var copyStylesInline = function(destinationNode, sourceNode) {
				var containerElements = ["svg","g"];
				for (var cd = 0; cd < destinationNode.childNodes.length; cd++) {
					var child = destinationNode.childNodes[cd];
					if (containerElements.indexOf(child.tagName) != -1) {
						copyStylesInline(child, sourceNode.childNodes[cd]);
						continue;
					}
					var style = sourceNode.childNodes[cd].currentStyle || window.getComputedStyle(sourceNode.childNodes[cd]);
					if (style == "undefined" || style == null) {
						continue;
					}
					for (var st = 0; st < style.length; st++){
						child.style.setProperty(style[st], style.getPropertyValue(style[st]));
					}
				}
			}
			
			var triggerDownload = function(imgURI, fileName) {
				var evt = new MouseEvent("click", {
					view: window,
					bubbles: false,
					cancelable: true
				});
				var a = document.createElement("a");
				a.setAttribute("download", fileName);
				a.setAttribute("href", imgURI);
				a.setAttribute("target", '_blank');
				a.dispatchEvent(evt);
			}
			
			var downloadSvg = function(svg, fileName) {
				var copy = svg.cloneNode(true);
				copyStylesInline(copy, svg);
				var canvas = document.createElement("canvas");
				// this bounding box is off for some reason (width-wise), it is always like 50px short
				// but we go through lengths to make sure the svg dimensions attributes are set correctly so we just use them
				var bbox = svg.getBBox();
				canvas.width = bbox.width;
				canvas.height = bbox.height;
				canvas.width = parseInt(svg.getAttribute("width"));
				canvas.height = parseInt(svg.getAttribute("height"));
				var ctx = canvas.getContext("2d");
				ctx.clearRect(0, 0, bbox.width, bbox.height);
				var data = (new XMLSerializer()).serializeToString(copy);
				var DOMURL = window.URL || window.webkitURL || window;
				var img = new Image();
				var svgBlob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
				var url = DOMURL.createObjectURL(svgBlob);
				img.onload = function () {
					ctx.drawImage(img, 0, 0);
					DOMURL.revokeObjectURL(url);
					if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob)	{
						var blob = canvas.msToBlob();         
						navigator.msSaveOrOpenBlob(blob, fileName);
					} 
					else {
						var imgURI = canvas
							.toDataURL("image/png")
							.replace("image/png", "image/octet-stream");
						triggerDownload(imgURI, fileName);
					}
					// was never added?
					//document.removeChild(canvas);
				};
				img.src = url;
			}
			
			downloadSvg(this.$refs.svg, this.model.name + ".png");
		}
	}
})