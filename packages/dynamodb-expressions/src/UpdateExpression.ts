import {ExpressionAttributes} from "./ExpressionAttributes";
import {AttributeName} from "./AttributeName";
import {AttributeValue} from "aws-sdk/clients/dynamodb";
import {
    FunctionExpression, isFunctionExpression,
    serializeFunctionExpression
} from "./FunctionExpression";
import {
    isMathematicalExpression,
    MathematicalExpression, serializeMathematicalExpression
} from "./MathematicalExpression";

export interface UpdateExpressionConfiguration {
    attributes?: ExpressionAttributes;
}

export class UpdateExpression {
    readonly attributes: ExpressionAttributes;

    private readonly toAdd: {[key: string]: string} = {};
    private readonly toDelete: {[key: string]: string} = {};
    private readonly toRemove = new Set<string>();
    private readonly toSet: {[key: string]: string} = {};

    constructor({
        attributes = new ExpressionAttributes()
    }: UpdateExpressionConfiguration = {}) {
        this.attributes = attributes;
    }

    add(path: AttributeName, value: AttributeValue): void {
        this.toAdd[this.attributes.addName(path)]
            = this.attributes.addValue(value);
    }

    delete(path: AttributeName, value: AttributeValue): void {
        this.toDelete[this.attributes.addName(path)]
            = this.attributes.addValue(value);
    }

    remove(path: AttributeName): void {
        this.toRemove.add(this.attributes.addName(path));
    }

    set(
        path: AttributeName,
        value: AttributeValue|FunctionExpression|MathematicalExpression
    ): void {
        const lhs = this.attributes.addName(path);
        let rhs: string;
        if (isFunctionExpression(value)) {
            rhs = serializeFunctionExpression(
                value,
                this.attributes,
            );
        } else if (isMathematicalExpression(value)) {
            rhs = serializeMathematicalExpression(
                value,
                this.attributes
            );
        } else {
            rhs = this.attributes.addValue(value);
        }

        this.toSet[lhs] = rhs;
    }

    toString(): string {
        const clauses: Array<string> = [];
        for (const [mapping, verb] of [
            [this.toAdd, 'ADD'],
            [this.toDelete, 'DELETE'],
        ] as Array<[{[key: string]: string}, string]>) {
            const keys = Object.keys(mapping);
            if (keys.length > 0) {
                clauses.push(`${verb} ${
                    keys.map(key => `${key} ${mapping[key]}`).join(', ')
                }`);
            }
        }

        const keys = Object.keys(this.toSet);
        if (keys.length > 0) {
            clauses.push(`SET ${
                keys.map(key => `${key} = ${this.toSet[key]}`).join(', ')
            }`);
        }

        if (this.toRemove.size > 0) {
            clauses.push(`REMOVE ${[...this.toRemove].join(', ')}`);
        }

        return clauses.join(' ');
    }
}