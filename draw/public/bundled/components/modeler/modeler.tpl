<template id="process-modeler-component">
	<div class="process-modeler-component is-row is-spacing-gap-medium">
		<template v-if="!model">
			<div class="is-column is-spacing-medium is-width-max-xsmall is-width-min-xsmall is-color-background is-border-full">
				<ul class="is-menu is-variant-toolbar is-align-center">
					<li class="is-column"><button @click="startNewModel" class="is-button is-variant-primary is-size-small"><icon name="plus"/><span class="is-text">New process</span></button></li>
				</ul>
				<div v-for="process in processes" class="is-row is-spacing-medium">
					<span class="is-text">{{process.name}}</span>
					<button class="is-button is-variant-primary-outline is-size-small is-position-right" @click="loadProcess(process.id)">Edit</button>
				</div>
			</div>
		</template>
		<template v-else>
			<n-form class="is-variant-vertical" content-class="is-column is-spacing-medium is-width-max-xsmall is-width-min-xsmall is-color-background is-border-full">
				<ul class="is-menu is-variant-toolbar is-align-center">
					<li class="is-column"><button @click="addState" class="is-button is-variant-primary is-size-xsmall"><icon name="plus"/><span class="is-text">State</span></button></li>
					<li class="is-column"><button @click="addActionToCurrent('service', 'Service call', gridSize * 15, actionHeight)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Service</span></button></li>
					<li class="is-column"><button @click="addActionToCurrent('finalizer', 'Exit', 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Finalizer</span></button></li>
					<li class="is-column"><button @click="addActionToCurrent('any', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">Any</span></button></li>
					<li class="is-column"><button @click="addActionToCurrent('all', null, 30, 30)" class="is-button is-variant-secondary is-size-xsmall"><icon name="plus"/><span class="is-text">All</span></button></li>
					<li class="is-column"><button @click="save" :disabled="saving" class="is-button is-variant-primary-outline is-size-xsmall"><icon name="save"/><span class="is-text">Save</span></button></li>
				</ul>
				<div v-if="selected.type == 'action'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.name" label="Action name" @input="updatedActionName(selected.target)" after="A short name for this action"/>
					<n-form-text v-if="selected.target.actionType == 'service'" v-model="selected.target.reference" label="Action reference" @input="draw" after="A reference for this action"/>
					<n-form-text v-if="selected.target.actionType == 'service'" type="area" v-model="selected.target.summary" label="Action summary" @input="updatedActionSummary(selected.target)" after="A longer summary what this action should do"/>
					<n-form-combo v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text v-if="selected.target.actionType == 'service'" v-model="selected.target.serviceId" label="Service id that is executed"/>
					<n-form-switch v-if="selected.target.actionType == 'service'" v-model="selected.target.automatic" label="Should the service be run automatically?" @input="draw"/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.automatic">
						<n-form-text v-model="selected.target.delay" label="Delay" :disabled="selected.target.schedule" after="You can run this action after a certain delay (e.g. 24 hours)" @input="draw"/>
						<n-form-text v-model="selected.target.schedule" label="Schedule" :disabled="selected.target.delay" after="You can run this action according to a certain schedule" @input="draw"/>
					</div>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.actionType == 'service'">
						<n-form-text v-model="selected.target.minOccurs" label="Min occurs" placeholder="1" after="How many times should the action at least be executed" @input="draw"/>
						<n-form-text v-model="selected.target.maxOccurs" label="Max occurs" placeholder="1" after="How many times should the action at most be executed" />
					</div>
					<n-form-text type="area" v-model="selected.target.description" label="Description" after="Additional description you want to add"/>
				</div>
				<div v-else-if="selected.type == 'actionRelation'" class="is-column is-spacing-gap-medium">
					<n-form-combo v-model="selected.target.relationType" label="Relation type" :items="['must', 'must-not', 'can']" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'state'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.name" label="State name" @input="draw" after="A short name for this state"/>
					<n-form-combo v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-switch v-model="selected.target.initial" label="Initial state" after="A new process instance can only be created in an initial state. There must be at least one in a process."/>
					<n-form-text type="area" v-model="selected.target.description" label="Description" after="Additional description you want to add"/>
				</div>
				<div v-else class="is-column is-spacing-gap-medium">
					<n-form-text v-model="model.name" label="Process name"/>
					<n-form-text v-model="model.queue" label="Process queue" after="By default each process instance has its own anonymous queue, you can however set a shared queue"/>
					<n-form-combo v-model="model.styling.theme" label="Theme" :items="themes" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text type="area" v-model="model.description" label="Process description" after="Additional description you want to add"/>
				</div>
			</n-form>
			<svg ref="svg"/>
		</template>
	</div>
</template>