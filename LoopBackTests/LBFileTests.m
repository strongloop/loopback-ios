//
//  LBFileTests.m
//  LoopBack
//
//  Created by Stephen Hess on 2/7/14.
//  Copyright (c) 2014 StrongLoop. All rights reserved.
//

#import "LBFileTests.h"

#import "LBFile.h"
#import "LBRESTAdapter.h"

@interface LBFileTests ()

@property (nonatomic) LBFileRepository *repository;

@end

@implementation LBFileTests

/**
 * Create the default test suite to control the order of test methods
 */
+ (id)defaultTestSuite {
    XCTestSuite *suite = [XCTestSuite testSuiteWithName:@"TestSuite for LBFile."];
    [suite addTest:[self testCaseWithSelector:@selector(testGetByName)]];
    [suite addTest:[self testCaseWithSelector:@selector(testUpload)]];
    [suite addTest:[self testCaseWithSelector:@selector(testDownload)]];
    return suite;
}


- (void)setUp {
    [super setUp];
    
    LBRESTAdapter *adapter = [LBRESTAdapter adapterWithURL:[NSURL URLWithString:@"http://localhost:3000"]];
    self.repository = (LBFileRepository*)[adapter repositoryWithClass:[LBFileRepository class]];
}

- (void)tearDown {
    [super tearDown];
}

- (void)testGetByName {
    NSString *tmpDir = NSTemporaryDirectory();
    ASYNC_TEST_START
    [self.repository getFileWithName:@"f1.txt" localPath:tmpDir container:@"container1" success:^(LBFile *file) {
        XCTAssertNotNil(file, @"File not found.");
        XCTAssertEqualObjects(file.name, @"f1.txt", @"Invalid name");
        ASYNC_TEST_SIGNAL
    } failure:ASYNC_TEST_FAILURE_BLOCK];
    ASYNC_TEST_END
}

- (void)testUpload {
    NSString *tmpDir = NSTemporaryDirectory();
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *fileName = @"uploadTest.txt";
    NSString *fullPath = [tmpDir stringByAppendingPathComponent:fileName];
    
    //Remove it if it currently exists...
    if ([fileManager fileExistsAtPath:fullPath]) {
        [fileManager removeItemAtPath:fullPath error:nil];
    }
    
    NSString* contents = @"Upload test";
    [contents writeToFile:fullPath atomically:YES encoding:NSUTF8StringEncoding error:nil];
    
    ASYNC_TEST_START
    LBFile __block *file = [self.repository createFileWithName:fileName localPath:tmpDir container:@"container1"];
    [file uploadWithSuccess:^(void) {
        ASYNC_TEST_SIGNAL
    } failure:ASYNC_TEST_FAILURE_BLOCK];
    ASYNC_TEST_END
}

- (void)testDownload {
    NSString *tmpDir = NSTemporaryDirectory();
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSString *fileName = @"uploadTest.txt";
    NSString *fullPath = [tmpDir stringByAppendingPathComponent:fileName];
    
    //Remove it if it currently exists locally...
    if ([fileManager fileExistsAtPath:fullPath]) {
        [fileManager removeItemAtPath:fullPath error:nil];
    }
    
    ASYNC_TEST_START
    [self.repository getFileWithName:@"uploadTest.txt" localPath:tmpDir container:@"container1" success:^(LBFile *file) {
        XCTAssertNotNil(file, @"File not found.");
        XCTAssertEqualObjects(file.name, @"uploadTest.txt", @"Invalid name");
        [file downloadWithSuccess:^(void) {
            XCTAssertTrue([fileManager fileExistsAtPath:fullPath], @"File missing.");
            NSString *fileContents = [NSString stringWithContentsOfFile:fullPath
                                                               encoding:NSUTF8StringEncoding
                                                                  error:nil];
            XCTAssertEqualObjects(fileContents, @"Upload test", @"File corrupted");
            ASYNC_TEST_SIGNAL
        } failure:ASYNC_TEST_FAILURE_BLOCK];
    } failure:ASYNC_TEST_FAILURE_BLOCK];
    ASYNC_TEST_END
}

@end
