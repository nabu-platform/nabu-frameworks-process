<template id="process-modeler-component">
	<div class="process-modeler-component is-row is-spacing-gap-medium">
		<template v-if="!model">
			<div class="is-column is-spacing-medium is-width-max-xsmall is-width-min-xsmall is-color-background is-border-full">
				<ul class="is-menu is-variant-toolbar is-align-center">
					<li class="is-column"><button @click="startNewModel" class="is-button is-variant-primary"><icon name="plus"/><span class="is-text">New process</span></button></li>
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
					<li class="is-column"><button @click="addState" class="is-button is-variant-primary"><icon name="plus"/><span class="is-text">State</span></button></li>
					<li class="is-column"><button @click="addActionToCurrent" class="is-button is-variant-secondary"><icon name="plus"/><span class="is-text">Action</span></button></li>
					<li class="is-column"><button @click="save" class="is-button is-variant-primary-outline"><icon name="save"/><span class="is-text">Save</span></button></li>
				</ul>
				<div v-if="selected.type == 'action'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.name" label="Action name" @input="updatedActionName(selected.target)" after="A short name for this action"/>
					<n-form-text v-model="selected.target.reference" label="Action reference" @input="draw" after="A reference for this action"/>
					<n-form-text type="area" v-model="selected.target.summary" label="Action summary" @input="updatedActionSummary(selected.target)" after="A longer summary what this action should do"/>
					<n-form-combo v-model="selected.target.styling.color" label="Color" :items="colors" :extracter="function(x) { return x.name }" :formatter="function(x) { return x.name }" @input="draw"/>
					<n-form-text v-model="selected.target.serviceId" label="Service id that is executed"/>
					<n-form-switch v-model="selected.target.automatic" label="Should the service be run automatically?" @input="draw"/>
					<div class="is-row is-spacing-gap-medium" v-if="selected.target.automatic">
						<n-form-text v-model="selected.target.delay" label="Delay" :disabled="selected.target.schedule" after="You can run this action after a certain delay (e.g. 24 hours)"/>
						<n-form-text v-model="selected.target.schedule" label="Schedule" :disabled="selected.target.delay" after="You can run this action according to a certain schedule"/>
					</div>
					<div class="is-row is-spacing-gap-medium">
						<n-form-text v-model="selected.target.minOccurs" label="Min occurs" placeholder="1" after="How many times should the action at least be executed" @input="draw"/>
						<n-form-text v-model="selected.target.maxOccurs" label="Max occurs" placeholder="1" after="How many times should the action at most be executed"/>
					</div>
					<n-form-switch v-model="selected.target.finalizer" label="Finalizer" after="When all mandatory finalizer actions in the current state are run, the process is considered complete" @input="draw"/>
					<n-form-text type="area" v-model="selected.target.description" label="Action description" after="Additional description you want to add"/>
				</div>
				<div v-else-if="selected.type == 'actionRelation'" class="is-column is-spacing-gap-medium">
					<n-form-combo v-model="selected.target.relationType" label="Relation type" :items="['must', 'must-not', 'can']" @input="draw"/>
				</div>
				<div v-else-if="selected.type == 'state'" class="is-column is-spacing-gap-medium">
					<n-form-text v-model="selected.target.name" label="State name" @input="draw" after="A short name for this state"/>
					<n-form-switch v-model="selected.target.initial" label="Initial state" after="A new process instance can only be created in an initial state. There must be at least one in a process."/>
				</div>
				<div v-else class="is-column is-spacing-gap-medium">
					<n-form-text v-model="model.name" label="Process name"/>
					<n-form-text v-model="model.queue" label="Process queue" after="By default each process instance has its own anonymous queue, you can however set a shared queue"/>
					<n-form-text type="area" v-model="model.description" label="Process description" after="Additional description you want to add"/>
				</div>
			</n-form>
			<svg ref="svg"/>
		</template>
	</div>
</template>