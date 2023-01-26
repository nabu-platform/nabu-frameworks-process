Suppose you have steps:

login -> get data -> post data

in a particular process

Obviously, the user can login, get the data and go away from the computer
When he comes back, you start a new instance of login (presumably set to maxoccurs 0), but you don't want to allow post data immediately.
So in that case, when a new login instance is started, we explicitly lock other running instances AND their child actions so they can not be used as a target.


Not all relationships are AND! You can login _or_ remember (or even impersonate) to get a valid user to perform the next action.


We must capture both before and after. The before is mostly to BLOCK execution if it is not allowed. This does mean we need SOME identifier in the input.
If we don't have a capturing identifier in the before phase, we only execute at the end (?)

An action WITHOUT an identifier is worthless (?) though we have some automatic identifiers like correlation, device,...

## Nesting

Some actions can be nested, for example we offer a rest service as an API. It is called and actually executes 3 steps.
We want to model all 4 to make it clear that everything happened (or not).
One child might succeed and the second fail. This will revert the whole transaction though undoing the first step as well...
It is important to keep track of "nested" calls for this reason.

If a nested task has an automatic child, this will be created as a task in the same (default) transaction context as the child.
This means, if the child has a scoped transaction, the task will be created. if the child does not (most likely usecase) the transaction will be rolled back, as will the creation of the task. So we should have consistent behavior.

## Blocking

A particular service (e.g. user login) can be part of multiple flows.
What happens if a certain is action is allowed by one flow but not by the other? Can we assume that if _any_ flow disallows it, it is blocked?

## Complex variable paths

We have had a situation where, depending on state, you want two actions in parallel or sequential.
