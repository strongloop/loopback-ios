/**
 * @file LBModel.m
 *
 * @author Michael Schoonmaker
 * @copyright (c) 2013 StrongLoop. All rights reserved.
 */

#import "LBModel.h"

#import <objc/runtime.h>

#define NSSelectorForSetter(key) NSSelectorFromString([NSString stringWithFormat:@"set%@:", [key stringByReplacingCharactersInRange:NSMakeRange(0,1) withString:[[key substringToIndex:1] capitalizedString]]])


@interface LBModel() {
    NSMutableDictionary *__overflow;
}

- (NSMutableDictionary *)_overflow;

@end

@implementation LBModel

- (instancetype)initWithRepository:(SLRepository *)repository parameters:(NSDictionary *)parameters {
    self = [super initWithRepository:repository parameters:parameters];

    if (self) {
        __overflow = [NSMutableDictionary dictionary];
    }

    return self;
}

- (id)objectForKeyedSubscript:(id <NSCopying>)key {
    return [__overflow objectForKey:key];
}

- (void)setObject:(id)obj forKeyedSubscript:(id <NSCopying>)key {
    [__overflow setObject:obj forKey:key];
}

- (NSMutableDictionary *)_overflow {
    return __overflow;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionaryWithDictionary:__overflow];

    for (Class targetClass = [self class]; targetClass != [LBModel superclass]; targetClass = [targetClass superclass]) {
        unsigned int propertyCount;
        objc_property_t *properties = class_copyPropertyList(targetClass, &propertyCount);

        for (int i = 0; i < propertyCount; i++) {
            NSString *propertyName = [NSString stringWithCString:property_getName(properties[i])
                                                        encoding:NSUTF8StringEncoding];
            [dict setValue:[self valueForKey:propertyName] forKey:propertyName];
        }
    }

    return dict;
}

- (NSString *)description {
    return [NSString stringWithFormat: @"<%@ %@>", NSStringFromClass([self class]), [self toDictionary]];
}

@end

@implementation LBModelRepository

- (instancetype)initWithClassName:(NSString *)name {
    self = [super initWithClassName:name];

    if (self) {
        NSString *modelClassName = NSStringFromClass([self class]);
        const int strlenOfRepository = 10;
        modelClassName = [modelClassName substringWithRange:NSMakeRange(0, [modelClassName length] - strlenOfRepository)];

        self.modelClass = NSClassFromString(modelClassName);
        if (!self.modelClass) {
            self.modelClass = [LBModel class];
        }
    }

    return self;
}

- (SLRESTContract *)contract {
    SLRESTContract *contract = [SLRESTContract contract];
    return contract;
}

- (LBModel *)modelWithDictionary:(NSDictionary *)dictionary {
    LBModel __block *model = (LBModel *)[[self.modelClass alloc] initWithRepository:self parameters:dictionary];

    [[model _overflow] addEntriesFromDictionary:dictionary];

    for (NSString *key in dictionary) {
        id obj = dictionary[key];
        @try {
            [model setValue:obj forKey:key];
        }
        @catch (NSException *e) {
            // ignore if no matching property exists
        }
    };
    return model;
}

@end
